import crypto from 'crypto';
import pg from 'pg';

// ---- Token/Session 鉴权（内联版）----
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBearerToken(request: any): string | null {
  const h = request.headers?.['authorization'] || request.headers?.['Authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function getSessionUser(client: any, request: any): Promise<{ id: string } | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const { rows } = await client.query(
    `SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.disabled = FALSE`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].user_id };
}

function getClient(): pg.Client {
  return new pg.Client({ connectionString: process.env.POSTGRES_URL });
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const client = getClient();
  try {
    await client.connect();
    // 确保 preferences 列存在
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;`);

    const user = await getSessionUser(client, request);
    if (!user) return response.status(401).json({ error: 'UNAUTHORIZED' });

    if (request.method === 'GET') {
      const { rows } = await client.query(
        `SELECT preferences FROM users WHERE id = $1`,
        [user.id]
      );
      const prefs = rows[0]?.preferences || {};
      // 只返回是否已配置，不返回完整 token（安全）
      return response.status(200).json({
        configured: !!(prefs.pushplus_token),
        // 脱敏显示：只显示前4后4
        masked: prefs.pushplus_token
          ? prefs.pushplus_token.slice(0, 4) + '****' + prefs.pushplus_token.slice(-4)
          : null,
      });
    }

    // POST: 保存 token
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const token = (body?.token || '').trim();

    // 空 token = 清除配置
    const { rows } = await client.query(`SELECT preferences FROM users WHERE id = $1`, [user.id]);
    const prefs = rows[0]?.preferences || {};
    if (token) {
      prefs.pushplus_token = token;
    } else {
      delete prefs.pushplus_token;
    }
    // 清除已发送标记（换 token 后重新开始）
    if (token !== (rows[0]?.preferences?.pushplus_token || '')) {
      delete prefs.pushplus_notified;
    }

    await client.query(`UPDATE users SET preferences = $1 WHERE id = $2`, [JSON.stringify(prefs), user.id]);
    return response.status(200).json({ ok: true, configured: !!token });
  } catch (e: any) {
    console.error('pushplus settings error:', e?.message);
    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    await client.end().catch(() => {});
  }
}
