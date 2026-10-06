
import pg from 'pg';
import { ensureSessionsTable, getSessionUser } from '../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request: any, response: any) {
  const client = await pool.connect();
  
  try {
    // Token 鉴权：userId 一律以 session 为准（忽略客户端传值，防越权）
    await ensureSessionsTable(client);
    const authUser = await getSessionUser(client, request);
    if (!authUser) {
        return response.status(401).json({ error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
    }
    if (authUser.disabled) {
        return response.status(403).json({ error: 'ACCOUNT_DISABLED', message: '账号已被禁用' });
    }
    const userId = authUser.id;

    // Check if table exists first to avoid errors on fresh deploy
    const { rows: tableCheck } = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'ledgers'
        );
    `);

    if (!tableCheck[0].exists) {
        return response.status(200).json([]);
    }

    // rev 列兼容（老表可能没有；sync 接口也会建，这里兜底）
    await client.query(`ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 0;`);

    const { rows } = await client.query(
        'SELECT data, rev FROM ledgers WHERE user_id=$1', 
        [userId]
    );
    
    if (rows.length > 0) {
        // PG driver automatically parses JSONB columns
        const result = rows[0].data;
        // 版本号走响应头：body 保持裸数组，兼容旧客户端
        response.setHeader('X-Ledger-Rev', String(rows[0].rev || 0));
        return response.status(200).json(result || []);
    } else {
        return response.status(200).json([]);
    }
  } catch (error: any) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: 'Fetch failed', details: error.message });
  } finally {
    client.release();
  }
}
