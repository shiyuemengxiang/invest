
import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  const client = createClient();
  try {
    await client.connect();
    const { userId } = request.query;

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Check if table exists
    const { rows: tableCheck } = await client.sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'ledgers'
        );
    `;

    if (!tableCheck[0].exists) {
        return response.status(200).json([]);
    }

    const { rows } = await client.sql`SELECT data FROM ledgers WHERE user_id=${userId}`;
    
    if (rows.length > 0) {
        return response.status(200).json(rows[0].data);
    } else {
        return response.status(200).json([]);
    }
  } catch (error: any) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: 'Fetch failed', details: error.message });
  } finally {
    await client.end();
  }
}