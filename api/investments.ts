
import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  if (!process.env.POSTGRES_URL) {
      return response.status(500).json({ error: 'Database configuration missing.' });
  }

  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    await client.connect();

    const { userId } = request.query;

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Check if table exists first
    const checkTable = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'ledgers'
        );
    `);

    if (!checkTable.rows[0].exists) {
        return response.status(200).json([]);
    }

    const { rows } = await client.query(`SELECT data FROM ledgers WHERE user_id=$1`, [userId]);
    
    if (rows.length > 0) {
        return response.status(200).json(rows[0].data);
    } else {
        return response.status(200).json([]);
    }
  } catch (error: any) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: 'Fetch failed', details: error.message });
  } finally {
    try { await client.end(); } catch(e) {}
  }
}
