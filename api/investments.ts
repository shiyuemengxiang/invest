
import { sql } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  try {
    const { userId } = request.query;

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    try {
        const { rows } = await sql`SELECT data FROM ledgers WHERE user_id=${userId}`;
        if (rows.length > 0) {
            return response.status(200).json(rows[0].data);
        } else {
            return response.status(200).json([]);
        }
    } catch (e: any) {
        // If table doesn't exist yet, return empty list instead of crashing
        if (e.message && e.message.includes('does not exist')) {
             return response.status(200).json([]);
        }
        throw e;
    } 
  } catch (error) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: String(error) });
  }
}
