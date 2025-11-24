
import { sql } from '@vercel/postgres';

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

    // Attempt to read from DB
    try {
        const { rows } = await sql`SELECT data FROM ledgers WHERE user_id=${userId}`;
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
    return response.status(500).json({ error: String(error) });
  }
}
