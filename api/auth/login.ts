
import { createClient } from '@vercel/postgres';
import crypto from 'crypto';

export default async function handler(request: any, response: any) {
  if (!process.env.POSTGRES_URL) {
      return response.status(500).json({ error: 'Database configuration missing (POSTGRES_URL).' });
  }

  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    await client.connect();
    
    const { email, password, type } = request.body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Email and password are required.' });
    }

    // Ensure Schema Exists
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
         if (e.code === '23505') { // Unique violation
            return response.status(400).json({ error: 'This email is already registered.' });
         }
         throw e;
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
       return response.status(401).json({ error: 'Invalid email or password.' });
    }
  } catch (error: any) {
    console.error("Database Login Error:", error);
    return response.status(500).json({ 
        error: 'Database connection failed.', 
        details: error.message || String(error) 
    });
  } finally {
    try { await client.end(); } catch(e) {}
  }
}
