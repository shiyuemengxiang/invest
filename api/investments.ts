
import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  if (!process.env.POSTGRES_URL) {
      return response.status(503).json({ error: 'Database not configured' });
  }

  const client = createClient({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    const { userId } = request.query;

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Attempt Connection
    await client.connect();

    try {
        const { rows } = await client.query(`SELECT data FROM ledgers WHERE user_id=$1`, [userId]);
        if (rows.length > 0) {
            return response.status(200).json(rows[0].data);
        } else {
            return response.status(200).json([]);
        }
    } catch (e: any) {
        // If table doesn't exist yet, return empty list
        if (e.message && e.message.includes('does not exist')) {
             return response.status(200).json([]);
        }
        throw e;
    } 
  } catch (error) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: String(error) });
  } finally {
    await client.end();
  }
}
