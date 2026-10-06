import pg from 'pg';
import bcrypt from 'bcryptjs';
import { ensureSessionsTable, getSessionUser } from '../../lib/server-auth';

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
