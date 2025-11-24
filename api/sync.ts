
import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
  }

  // --- MOCK MODE (When DB is not connected) ---
  if (!process.env.POSTGRES_URL) {
    console.warn("MOCK MODE: Skipping cloud sync (POSTGRES_URL missing)");
    return response.status(200).json({ success: true, mode: 'mock' });
  }

  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  });
  await client.connect();

  try {
    const { userId, data } = request.body;
    
    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Ensure table exists
    await client.query(`CREATE TABLE IF NOT EXISTS ledgers (user_id TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

    // Upsert data
    const jsonStr = JSON.stringify(data);
    await client.query(`
        INSERT INTO ledgers (user_id, data, updated_at) 
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP) 
        ON CONFLICT (user_id) 
        DO UPDATE SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP;
    `, [userId, jsonStr]);

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: String(error) });
  } finally {
    await client.end();
  }
}