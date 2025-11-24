
import { createClient } from '@vercel/postgres';
import crypto from 'crypto';

export default async function handler(request: any, response: any) {
  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    const { email, password, type } = request.body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Missing credentials' });
    }

    if (!process.env.POSTGRES_URL) {
        return response.status(503).json({ error: 'Database not configured (POSTGRES_URL missing)' });
    }
    
    // 1. Attempt Connection
    try {
        await client.connect();
    } catch (connErr) {
        console.error("DB Connection Failed:", connErr);
        return response.status(500).json({ error: 'Database connection failed' });
    }
    
    // 2. Perform DB Operations
    try {
        // Ensure table exists
        await client.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT);`);

        if (type === 'register') {
           const id = crypto.randomUUID();
           try {
             await client.query(
                `INSERT INTO users (id, email, password) VALUES ($1, $2, $3)`,
                [id, email, password]
             );
             return response.status(200).json({ id, email });
           } catch (e: any) {
             // Postgres unique violation code is 23505
             if (e.code === '23505') {
                return response.status(400).json({ error: '该邮箱已被注册' });
             }
             console.error("Register Error:", e);
             return response.status(500).json({ error: '注册失败，请稍后重试' });
           }
        } else {
           // Login
           const { rows } = await client.query(
                `SELECT * FROM users WHERE email=$1 AND password=$2`,
                [email, password]
           );
           if (rows.length > 0) {
               return response.status(200).json({ id: rows[0].id, email: rows[0].email });
           }
           return response.status(401).json({ error: '邮箱或密码错误' });
        }
    } finally {
        await client.end();
    }
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: String(error) });
  }
}
