
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request: any, response: any) {
  const client = await pool.connect();
  
  try {
    // Robust query parsing
    // In some envs query is an object, in others we might need to parse URL
    let userId = request.query?.userId;
    
    if (!userId && request.url.includes('?')) {
        const searchParams = new URLSearchParams(request.url.split('?')[1]);
        userId = searchParams.get('userId');
    }

    if (!userId) {
        return response.status(400).json({ error: 'Missing userId' });
    }

    // Check if table exists first to avoid errors on fresh deploy
    const { rows: tableCheck } = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'ledgers'
        );
    `);

    if (!tableCheck[0].exists) {
        return response.status(200).json([]);
    }

    const { rows } = await client.query(
        'SELECT data FROM ledgers WHERE user_id=$1', 
        [userId]
    );
    
    if (rows.length > 0) {
        // PG driver automatically parses JSONB columns
        const result = rows[0].data;
        return response.status(200).json(result || []);
    } else {
        return response.status(200).json([]);
    }
  } catch (error: any) {
    console.error("Investments API Error:", error);
    return response.status(500).json({ error: 'Fetch failed', details: error.message });
  } finally {
    client.release();
  }
}
