
import pg from 'pg';

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
    // Robust parsing: handle object or string body
    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            // console.warn('Failed to parse body', e);
        }
    }
    
    const { userId, data } = body;
    
    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS ledgers (
        user_id TEXT PRIMARY KEY, 
        data JSONB, 
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Upsert data using ON CONFLICT
    // IMPORTANT: Use JSON.stringify for the data param and explicit ::jsonb cast
    const jsonData = JSON.stringify(data || []);

    await client.query(`
        INSERT INTO ledgers (user_id, data, updated_at) 
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP) 
        ON CONFLICT (user_id) 
        DO UPDATE SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
    `, [userId, jsonData]);

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return response.status(500).json({ error: 'Sync failed', details: error.message });
  } finally {
    client.release();
  }
}
