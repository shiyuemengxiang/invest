import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ensureSessionsTable, getSessionUser, isAdminEmail } from '../../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const BCRYPT_ROUNDS = 10;

// ---- 极简管理后台 ----
// 鉴权：登录 session 的邮箱必须等于服务端环境变量 ADMIN_EMAIL。
// （此前 x-admin-key 过渡方案已移除，不再需要 ADMIN_SECRET。）
async function requireAdmin(client: any, request: any, response: any) {
  await ensureSessionsTable(client);
  const authUser = await getSessionUser(client, request);
  if (!authUser) {
    response.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
    return null;
  }
  if (!isAdminEmail(authUser.email)) {
    response.status(403).json({ error: 'FORBIDDEN', message: '无管理权限' });
    return null;
  }
  return authUser;
}

function genTempPassword(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12) || 'Tmp' + Date.now().toString(36);
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();
  try {
    const admin = await requireAdmin(client, request, response);
    if (!admin) return;

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
      if (!userId) return response.status(400).json({ error: 'Missing userId' });
      // 禁止删除自己
      if (userId === admin.id) {
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
    const { action, userId } = body || {};
    if (!action || !userId) {
      return response.status(400).json({ error: 'Missing action or userId' });
    }

    // ---------- 禁用 / 启用 ----------
    if (action === 'disable' || action === 'enable') {
      // 禁止禁用自己（否则把自己锁在门外）
      if (action === 'disable' && userId === admin.id) {
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
      // 密码变更后踢掉该用户所有 session（强制重登）
      await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]).catch(() => {});
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
