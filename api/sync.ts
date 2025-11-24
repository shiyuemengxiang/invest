
import { sql } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
  }

  // --- MOCK MODE (When DB is not connected) ---
  if (!process.env.POSTGRES_URL) {
    console.warn("MOCK MODE: Skipping cloud sync (POSTGRES_URL missing)");
    return response.status(200).json({ success: true, mode: 'mock' });
  }

  try {
    const { userId, data } = request.body;
    
    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Ensure table exists (Lazy setup)
    // Using JSONB to store the entire ledger array for simplicity and schema flexibility
    try {
        await sql`CREATE TABLE IF NOT EXISTS ledgers (user_id TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`;
    } catch (e) {
        console.error("DB Init Error", e);
    }

    // Upsert data
    await sql`
        INSERT INTO ledgers (user_id, data, updated_at) 
        VALUES (${userId}, ${JSON.stringify(data)}::jsonb, CURRENT_TIMESTAMP) 
        ON CONFLICT (user_id) 
        DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, updated_at = CURRENT_TIMESTAMP;
    `;

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: String(error) });
  }
}
