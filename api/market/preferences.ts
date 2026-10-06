
import pg from 'pg';
import { ensureSessionsTable, getSessionUser } from '../../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    
    const { userId, preferences } = body;
    
    if (!userId || !preferences) {
        return response.status(400).json({ error: 'Missing userId or preferences' });
    }

    // Token 鉴权：只能改自己的偏好设置
    await ensureSessionsTable(client);
    const authUser = await getSessionUser(client, request);
    if (!authUser) {
        return response.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
    }
    if (authUser.id !== userId) {
        return response.status(403).json({ error: 'FORBIDDEN' });
    }

    // Update preferences column
    await client.query(
        'UPDATE users SET preferences = $1::jsonb WHERE id = $2',
        [JSON.stringify(preferences), userId]
    );

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Preferences Update Error:", error);
    return response.status(500).json({ error: 'Update failed', details: error.message });
  } finally {
    client.release();
  }
}
