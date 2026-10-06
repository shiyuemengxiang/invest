
import pg from 'pg';

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
    // Robust query parsing
    // In some envs query is an object, in others we might need to parse URL
    let userId = request.query?.userId;
    
    if (!userId && request.url.includes('?')) {
        const searchParams = new URLSearchParams(request.url.split('?')[1]);
        userId = searchParams.get('userId');
    }

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // 账号存活校验（防僵尸会话）：被删除/禁用的用户各端下次请求即被强制登出
    try {
        const { rows: urows } = await client.query('SELECT disabled FROM users WHERE id = $1', [userId]);
        if (urows.length === 0) {
            return response.status(401).json({ error: 'USER_DELETED', message: '账号已被删除' });
        }
        if (urows[0].disabled) {
            return response.status(403).json({ error: 'ACCOUNT_DISABLED', message: '账号已被禁用' });
        }
    } catch (e) {
        // users 表不存在等极端情况：放行，避免误杀
    }

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
