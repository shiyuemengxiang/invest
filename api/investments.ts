
import { createClient } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  try {
    // --- MOCK MODE (When DB is not connected) ---
    if (!process.env.POSTGRES_URL) {
        console.warn("MOCK MODE: Returning empty list (POSTGRES_URL missing)");
        return response.status(200).json([]);
    }

    const { userId } = request.query;

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    const client = createClient();
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
    } finally {
        await client.end();
    }

  } catch (error) {
    return response.status(500).json({ error: String(error) });
  }
}
