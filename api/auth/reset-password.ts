import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ensureResetTable } from '../../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const BCRYPT_ROUNDS = 10;

// POST /api/auth/reset-password
// Body: { token, newPassword }
// 用邮件中的 token 重置密码。成功后作废 token 并踢掉该用户所有 session。
export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  try {
    await ensureResetTable(client);

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { token, newPassword } = body || {};
    if (!token || !newPassword) {
      return response.status(400).json({ error: 'Missing token or newPassword' });
    }
    if (String(newPassword).length < 6) {
      return response.status(400).json({ error: 'WEAK_PASSWORD', message: '新密码至少 6 位' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    if (rows.length === 0) {
      return response.status(400).json({ error: 'INVALID_TOKEN', message: '链接无效或已过期，请重新申请' });
    }
    const reset = rows[0];

    const hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, reset.user_id]);
    await client.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [reset.id]);
    // 踢掉所有 session，强制重登
    await client.query('DELETE FROM sessions WHERE user_id = $1', [reset.user_id]).catch(() => {});

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return response.status(500).json({ error: 'Operation failed' });
  } finally {
    client.release();
  }
}
