
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Initialize Pool outside handler for potential reuse in warm environments
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false // Required for Vercel/Neon Postgres
  }
});

// 读取用户账本基线（条数/rev/更新时间），供客户端登录时裁决同步方向。
// 失败时返回 null（例如 ledgers 表尚未创建），不阻塞登录。
async function getLedgerMeta(client: any, userId: string) {
  try {
    const { rows } = await client.query(
      `SELECT
         CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 0 END AS count,
         rev, updated_at
       FROM ledgers WHERE user_id = $1`,
      [userId]
    );
    if (rows.length === 0) return null;
    return {
      count: Number(rows[0].count) || 0,
      rev: rows[0].rev || 0,
      updatedAt: rows[0].updated_at || null
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();
  
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { email, password, type } = body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Email and password are required.' });
    }

    // Ensure Table Exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, 
        email TEXT UNIQUE, 
        password TEXT
      );
    `);
    
    // Schema Migration: Add preferences column if it doesn't exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;
    `);

    if (type === 'register') {
       const id = crypto.randomUUID();
       try {
         await client.query(
           'INSERT INTO users (id, email, password, preferences) VALUES ($1, $2, $3, $4)',
           [id, email, password, '{}']
         );
         return response.status(200).json({ id, email, preferences: {}, ledgerMeta: null });
       } catch (e: any) {
         if (e.code === '23505') { // Unique violation
            return response.status(400).json({ error: 'EMAIL_EXISTS' });
         }
         throw e;
       }
    } else {
       // Login Logic
       
       // 1. Check if user exists
       const { rows: userRows } = await client.query(
         'SELECT id, email, password, preferences FROM users WHERE email=$1',
         [email]
       );

       if (userRows.length === 0) {
           return response.status(404).json({ error: 'USER_NOT_FOUND' });
       }
       
       // 2. Check password
       const user = userRows[0];
       if (user.password !== password) {
            return response.status(401).json({ error: 'INVALID_PASSWORD' });
       }
       
       return response.status(200).json({ 
           id: user.id, 
           email: user.email,
           preferences: user.preferences || {},
           ledgerMeta: await getLedgerMeta(client, user.id)
       });
    }
  } catch (error: any) {
    console.error("Database Login Error:", error);
    return response.status(500).json({ 
        error: 'Database operation failed.', 
        details: error.message || String(error) 
    });
  } finally {
    client.release();
  }
}
