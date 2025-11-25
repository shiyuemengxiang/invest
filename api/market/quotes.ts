
import yahooFinance from 'yahoo-finance2';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    
    const { symbols } = body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return response.status(400).json({ error: 'Missing symbols array' });
    }

    const uniqueSymbols = Array.from(new Set(symbols as string[]));
    const result: Record<string, number> = {};

    const fetchQuote = async (symbol: string) => {
        // Method 1: Library (often blocked on Vercel)
        try {
            // Fix: Cast result to any to avoid TypeScript 'never' inference issue with yahoo-finance2
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            return quote.regularMarketPrice || quote.ask || quote.bid;
        } catch (libError) {
            // Method 2: Direct Fetch with Browser Headers
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    if (meta && meta.regularMarketPrice) {
                        return meta.regularMarketPrice;
                    }
                }
            } catch (fallbackError) {
                // Ignore
            }
            return null;
        }
    };

    const promises = uniqueSymbols.map(async (symbol) => {
        const price = await fetchQuote(symbol);
        return { symbol, price };
    });

    const outcomes = await Promise.allSettled(promises);

    outcomes.forEach(outcome => {
        if (outcome.status === 'fulfilled' && outcome.value) {
            const { symbol, price } = outcome.value;
            if (price !== undefined && price !== null) {
                result[symbol] = price;
            }
        }
    });

    return response.status(200).json(result);
  } catch (error: any) {
    console.error("Market Quotes Critical Error:", error);
    return response.status(200).json({});
  }
}
