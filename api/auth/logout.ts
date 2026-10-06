import pg from 'pg';
import { ensureSessionsTable, deleteSession } from '../../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// POST /api/auth/logout
// 删除服务端 session。客户端同时清除本地 token。
export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const client = await pool.connect();
  try {
    await ensureSessionsTable(client);
    await deleteSession(client, request);
    return response.status(200).json({ success: true });
  } catch (error: any) {
    return response.status(500).json({ error: 'Logout failed' });
  } finally {
    client.release();
  }
}
