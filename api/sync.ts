import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
  }

  const client = createClient();

  try {
    await client.connect();
    const { userId, data } = request.body;
    
    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Ensure table exists
    await client.sql`CREATE TABLE IF NOT EXISTS ledgers (user_id TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`;

    const jsonStr = JSON.stringify(data);

    // Upsert data using ON CONFLICT
    await client.sql`
        INSERT INTO ledgers (user_id, data, updated_at) 
        VALUES (${userId}, ${jsonStr}::jsonb, CURRENT_TIMESTAMP) 
        ON CONFLICT (user_id) 
        DO UPDATE SET data = ${jsonStr}::jsonb, updated_at = CURRENT_TIMESTAMP;
    `;

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return response.status(500).json({ error: 'Sync failed', details: error.message });
  } finally {
    await client.end();
  }
}