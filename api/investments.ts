import { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';

const { Pool } = pg;

// 必须确保 Vercel 环境变量中有 POSTGRES_URL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = await pool.connect();
  
  try {
    // 1. 获取用户ID (默认为 'default_user'，单用户模式够用了)
    const userId = (req.query.userId as string) || 'default_user';

    // 2. 自动建表 (如果表不存在)
    // 这一步保证了您不需要手动去数据库执行 SQL
    await client.query(`
      CREATE TABLE IF NOT EXISTS ledgers (
        user_id TEXT PRIMARY KEY,
        data JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // GET: 读取数据 (从数据库拉取最新存档)
    // ==========================================
    if (req.method === 'GET') {
      const { rows } = await client.query(
        'SELECT data FROM ledgers WHERE user_id = $1', 
        [userId]
      );
      
      if (rows.length > 0) {
        return res.status(200).json(rows[0].data || []);
      } else {
        return res.status(200).json([]);
      }
    }

    // ==========================================
    // POST: 保存数据 (核心修复！！！)
    // ==========================================
    if (req.method === 'POST') {
      const newData = req.body;

      // 简单防错
      if (!Array.isArray(newData)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
      }

      // 执行写入：如果 ID 存在则更新，不存在则插入 (Upsert)
      await client.query(`
        INSERT INTO ledgers (user_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          data = EXCLUDED.data,
          updated_at = NOW();
      `, [userId, JSON.stringify(newData)]);

      return res.status(200).json({ success: true, message: 'Data persisted to Postgres' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  } finally {
    client.release();
  }
}