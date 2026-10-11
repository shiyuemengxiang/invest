import crypto from 'crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

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

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const BCRYPT_ROUNDS = 10;

function isBcryptHash(s: any): boolean {
  return typeof s === 'string' && /^\$2[aby]\$\d{2}\$/.test(s);
}

// POST /api/auth/change-password
// Body: { oldPassword, newPassword }
// Token 鉴权：只能改自己的密码。
export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  try {
    await ensureSessionsTable(client);
    const authUser = await getSessionUser(client, request);
    if (!authUser) {
      return response.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
    }
    if (authUser.disabled) {
      return response.status(403).json({ error: 'ACCOUNT_DISABLED' });
    }
    const userId = authUser.id;

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { oldPassword, newPassword } = body || {};

    if (!oldPassword || !newPassword) {
      return response.status(400).json({ error: 'Missing oldPassword or newPassword' });
    }
    if (String(newPassword).length < 6) {
      return response.status(400).json({ error: 'WEAK_PASSWORD', message: '新密码至少 6 位' });
    }

    const { rows } = await client.query('SELECT id, password, disabled FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return response.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    const user = rows[0];

    let ok = false;
    if (isBcryptHash(user.password)) {
      ok = await bcrypt.compare(String(oldPassword), user.password);
    } else {
      ok = (String(oldPassword) === user.password);
    }
    if (!ok) {
      return response.status(401).json({ error: 'INVALID_CREDENTIALS', message: '原密码错误' });
    }

    const hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Change password error:', error);
    return response.status(500).json({ error: 'Operation failed', details: error.message });
  } finally {
    client.release();
  }
}
