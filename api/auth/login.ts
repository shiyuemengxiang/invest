
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

export default async function handler(request: any, response: any) {
  try {
    if (!process.env.POSTGRES_URL) {
      return response.status(500).json({ error: 'Database not configured (POSTGRES_URL missing)' });
    }

    const { email, password, type } = request.body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Missing credentials' });
    }

    // Ensure table exists (Lazy setup)
    try {
        await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT);`;
    } catch (e) {
        console.error("DB Init Error", e);
    }

    if (type === 'register') {
       const id = crypto.randomUUID();
       try {
         await sql`INSERT INTO users (id, email, password) VALUES (${id}, ${email}, ${password})`;
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
       const { rows } = await sql`SELECT * FROM users WHERE email=${email} AND password=${password}`;
       if (rows.length > 0) {
           return response.status(200).json({ id: rows[0].id, email: rows[0].email });
       }
       return response.status(401).json({ error: '邮箱或密码错误' });
    }
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: String(error) });
  }
}
