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

// ---- 账号存活校验（防僵尸会话）----
// 用户被删除/禁用后，各客户端下次请求即收到 401/403 并被强制登出。
// users 表不存在等极端情况放行，避免误杀。
async function checkUserActive(client: any, userId: string): Promise<'ok' | 'deleted' | 'disabled'> {
  try {
    const { rows } = await client.query('SELECT disabled FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return 'deleted';
    if (rows[0].disabled) return 'disabled';
    return 'ok';
  } catch (e) {
    return 'ok';
  }
}

function userGoneResponse(response: any, status: 'deleted' | 'disabled') {
  if (status === 'deleted') {
    return response.status(401).json({ error: 'USER_DELETED', message: '账号已被删除' });
  }
  return response.status(403).json({ error: 'ACCOUNT_DISABLED', message: '账号已被禁用' });
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();

  try {
    await ensureTables(client);

    // ---------- GET /api/sync?userId=... : 备份列表 ----------
    if (request.method === 'GET') {
      const userId = request.query?.userId;
      if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
      }
      const active = await checkUserActive(client, userId);
      if (active !== 'ok') return userGoneResponse(response, active);
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
    const { userId, data, baseRev, forceClear, action, backupId } = body;

    if (!userId) {
      return response.status(400).json({ error: 'Missing userId' });
    }

    const active = await checkUserActive(client, userId);
    if (active !== 'ok') return userGoneResponse(response, active);

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
    if (baseRev !== undefined && baseRev !== null && Number(baseRev) !== storedRev) {
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
