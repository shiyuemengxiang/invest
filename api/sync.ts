import crypto from 'crypto';
// ---- Token/Session 鉴权（内联版：Vercel 不打包 api/ 之外的 lib，故内联于此）----
const SESSION_DAYS = 30;

interface AuthedUser {
  id: string;
  email: string;
  disabled: boolean;
}

async function ensureSessionsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);`);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(client: any, userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await client.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 || ' days')::interval)`,
    [hashToken(token), userId, String(SESSION_DAYS)]
  );
  await client.query('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP').catch(() => {});
  return token;
}

function getBearerToken(request: any): string | null {
  const h = request.headers?.['authorization'] || request.headers?.['Authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function getSessionUser(client: any, request: any): Promise<AuthedUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const { rows } = await client.query(
    `SELECT s.user_id, u.email, u.disabled
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  await client.query(
    `UPDATE sessions SET expires_at = CURRENT_TIMESTAMP + ($1 || ' days')::interval WHERE token_hash = $2`,
    [String(SESSION_DAYS), hashToken(token)]
  ).catch(() => {});
  return { id: rows[0].user_id, email: rows[0].email, disabled: !!rows[0].disabled };
}

async function deleteSession(client: any, request: any): Promise<void> {
  const token = getBearerToken(request);
  if (!token) return;
  await client.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]).catch(() => {});
}

async function ensureResetTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_pwd_resets_token ON password_resets(token_hash);`);
}

function isAdminEmail(email: string | undefined | null): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && !!email && email.toLowerCase() === adminEmail.toLowerCase();
}
import pg from 'pg';


const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ---- 同步安全策略（阶段一 P0）----
// 数据骤降熔断：历史>=CLIFF_BASELINE 条 且 本次<50% 时拦截，需 forceClear 二次确认
const CLIFF_BASELINE = 10;
const CLIFF_RATIO = 0.5;
// 快照保留天数
const BACKUP_RETENTION_DAYS = 30;

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ledgers (
      user_id TEXT PRIMARY KEY,
      data JSONB,
      rev INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // 老表兼容：补 rev 列
  await client.query(`ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 0;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ledger_backups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data JSONB NOT NULL,
      rev INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT 'pre-overwrite',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ledger_backups_user ON ledger_backups (user_id, created_at DESC);`);
}

// 写前快照：返回快照 id；无历史数据时返回 null
async function snapshot(client: any, userId: string, reason: string): Promise<string | null> {
  const { rows } = await client.query('SELECT data, rev FROM ledgers WHERE user_id = $1', [userId]);
  if (rows.length === 0) return null;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await client.query(
    `INSERT INTO ledger_backups (id, user_id, data, rev, reason) VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [id, userId, JSON.stringify(rows[0].data || []), rows[0].rev || 0, reason]
  );
  // 清理过期快照
  await client.query(
    `DELETE FROM ledger_backups WHERE user_id = $1 AND created_at < NOW() - ($2 || ' days')::interval`,
    [userId, String(BACKUP_RETENTION_DAYS)]
  );
  return id;
}

function parseBody(request: any) {
  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // 保持原样，后续校验会处理
    }
  }
  return body || {};
}

// ---- 账号鉴权（阶段二-7 Token）----
// 所有写操作以 session 中的 userId 为准，不再信任客户端传的 userId。
async function requireAuth(client: any, request: any, response: any) {
  await ensureSessionsTable(client);
  const authUser = await getSessionUser(client, request);
  if (!authUser) {
    response.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
    return null;
  }
  if (authUser.disabled) {
    response.status(403).json({ error: 'ACCOUNT_DISABLED', message: '账号已被禁用' });
    return null;
  }
  return authUser;
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();

  try {
    await ensureTables(client);

    // ---------- GET /api/sync : 备份列表 ----------
    if (request.method === 'GET') {
      const authUser = await requireAuth(client, request, response);
      if (!authUser) return;
      const userId = authUser.id;
      const { rows } = await client.query(
        `SELECT id, rev, reason, created_at,
                CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 0 END AS count
         FROM ledger_backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );
      return response.status(200).json(rows);
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseBody(request);
    const { data, baseRev, forceClear, action, backupId } = body;
    // userId 一律以 session 为准（忽略客户端传值，防越权）
    const authUser = await requireAuth(client, request, response);
    if (!authUser) return;
    const userId = authUser.id;

    // ---------- POST 回滚：{ userId, action: 'restore', backupId } ----------
    if (action === 'restore') {
      if (!backupId) {
        return response.status(400).json({ error: 'Missing backupId' });
      }
      const { rows } = await client.query(
        'SELECT data, rev FROM ledger_backups WHERE id = $1 AND user_id = $2',
        [backupId, userId]
      );
      if (rows.length === 0) {
        return response.status(404).json({ error: 'Backup not found' });
      }
      // 回滚前先快照当前状态（可二次回滚）
      await snapshot(client, userId, 'pre-restore');
      const cur = await client.query('SELECT rev FROM ledgers WHERE user_id = $1', [userId]);
      const newRev = (cur.rows[0]?.rev || 0) + 1;
      await client.query(
        `INSERT INTO ledgers (user_id, data, rev, updated_at)
         VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET data = $2::jsonb, rev = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify(rows[0].data || []), newRev]
      );
      return response.status(200).json({ success: true, rev: newRev });
    }

    // ---------- POST 同步上传：{ userId, data, baseRev?, forceClear? } ----------
    if (!Array.isArray(data)) {
      return response.status(400).json({ error: 'Invalid data format. Expected an array.' });
    }

    const { rows: curRows } = await client.query(
      'SELECT data, rev FROM ledgers WHERE user_id = $1',
      [userId]
    );
    const stored = curRows[0];
    const storedCount = stored && Array.isArray(stored.data) ? stored.data.length : 0;
    const storedRev = stored ? (stored.rev || 0) : 0;

    // 1) 版本冲突：客户端基于过期版本上传时拒绝，由 UI 提示用户裁决
    //    注意：云端尚无账本行（首次上传）时跳过比较，否则重注册/新账号会因浏览器残留旧版本号而误报 409
    if (stored && baseRev !== undefined && baseRev !== null && Number(baseRev) !== storedRev) {
      return response.status(409).json({
        error: 'CONFLICT',
        serverRev: storedRev,
        message: '云端数据已被其他端更新，请先同步后再试'
      });
    }

    // 2) 数据骤降熔断：非空骤降同样拦截（本次事故就是 123 -> 3 条 demo）
    if (!forceClear && storedCount >= CLIFF_BASELINE && data.length < storedCount * CLIFF_RATIO) {
      return response.status(422).json({
        error: 'DATA_CLIFF',
        stored: storedCount,
        incoming: data.length,
        message: `云端有 ${storedCount} 条，本次仅 ${data.length} 条，已拦截覆盖。如确认要清空请二次确认后重试`
      });
    }

    // 3) 写前快照（兜底）
    await snapshot(client, userId, forceClear ? 'data-cliff-forced' : 'pre-overwrite');

    const newRev = storedRev + 1;
    await client.query(
      `INSERT INTO ledgers (user_id, data, rev, updated_at)
       VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET data = $2::jsonb, rev = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(data), newRev]
    );

    return response.status(200).json({ success: true, rev: newRev });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return response.status(500).json({ error: 'Sync failed', details: error.message });
  } finally {
    client.release();
  }
}
