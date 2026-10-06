import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const BCRYPT_ROUNDS = 10;

// ---- 极简管理后台（阶段四） ----
// 鉴权：请求头 x-admin-key 必须等于 Vercel 环境变量 ADMIN_SECRET。
// 这是 token 鉴权（阶段二-7）落地前的过渡方案：密钥仅管理员知晓，
// 前端管理页每次会话输入一次，存 sessionStorage（关标签页即清除）。
function checkAdmin(request: any, response: any): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    response.status(503).json({ error: 'ADMIN_NOT_CONFIGURED', message: '未配置 ADMIN_SECRET' });
    return false;
  }
  const key = request.headers?.['x-admin-key'] || request.headers?.['X-Admin-Key'];
  if (key !== secret) {
    response.status(401).json({ error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

function genTempPassword(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12) || 'Tmp' + Date.now().toString(36);
}

export default async function handler(request: any, response: any) {
  if (!checkAdmin(request, response)) return;

  const client = await pool.connect();
  try {
    // ---------- GET：用户列表 ----------
    if (request.method === 'GET') {
      const { rows } = await client.query(`
        SELECT u.id, u.email, u.disabled, u.created_at,
               CASE WHEN jsonb_typeof(l.data) = 'array' THEN jsonb_array_length(l.data) ELSE 0 END AS ledger_count,
               COALESCE(l.rev, 0) AS ledger_rev,
               l.updated_at AS ledger_updated_at
        FROM users u
        LEFT JOIN ledgers l ON l.user_id = u.id
        ORDER BY u.created_at DESC NULLS LAST
      `);
      return response.status(200).json(rows);
    }

    // ---------- DELETE：删除用户及其全部数据 ----------
    if (request.method === 'DELETE') {
      const userId = request.query?.userId;
      const callerUserId = request.query?.callerUserId;
      if (!userId) return response.status(400).json({ error: 'Missing userId' });
      // 禁止删除自己（callerUserId 由管理端如实传递，防误操作）
      if (callerUserId && callerUserId === userId) {
        return response.status(400).json({ error: 'CANNOT_SELF', message: '不能删除自己的账号' });
      }
      await client.query('DELETE FROM ledger_backups WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM ledgers WHERE user_id = $1', [userId]);
      const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [userId]);
      return response.status(200).json({ success: true, deleted: rowCount });
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { action, userId, callerUserId } = body || {};
    if (!action || !userId) {
      return response.status(400).json({ error: 'Missing action or userId' });
    }

    // ---------- 禁用 / 启用 ----------
    if (action === 'disable' || action === 'enable') {
      // 禁止禁用自己（否则把自己锁在门外）
      if (action === 'disable' && callerUserId && callerUserId === userId) {
        return response.status(400).json({ error: 'CANNOT_SELF', message: '不能禁用自己的账号' });
      }
      await client.query('UPDATE users SET disabled = $1 WHERE id = $2', [action === 'disable', userId]);
      return response.status(200).json({ success: true, disabled: action === 'disable' });
    }

    // ---------- 重置密码：生成一次性临时密码（哈希存储，明文仅返回一次） ----------
    if (action === 'reset-password') {
      const tempPassword = genTempPassword();
      const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
      const { rowCount } = await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, userId]);
      if (!rowCount) return response.status(404).json({ error: 'USER_NOT_FOUND' });
      return response.status(200).json({ success: true, tempPassword });
    }

    return response.status(400).json({ error: 'Unknown action' });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return response.status(500).json({ error: 'Operation failed', details: error.message });
  } finally {
    client.release();
  }
}
