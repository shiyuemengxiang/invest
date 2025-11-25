
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
    console.log(`[API Quotes] Received request for symbols: ${JSON.stringify(symbols)}`);
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return response.status(400).json({ error: 'Missing symbols array' });
    }

    const uniqueSymbols = Array.from(new Set(symbols as string[]));
    const result: Record<string, number> = {};

    const fetchQuote = async (symbol: string) => {
        // Method 1: Library
        try {
            // Suppress validation errors
            // Cast to any to bypass TS inference issues with the library types
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            const price = quote.regularMarketPrice || quote.ask || quote.bid;
            console.log(`[API Quotes] YahooLib success for ${symbol}: ${price}`);
            return price;
        } catch (libError: any) {
            console.warn(`[API Quotes] YahooLib failed for ${symbol}: ${libError.message}`);
            
            // Method 2: Direct Fetch with Browser Headers (Fallback)
            try {
                const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const res = await fetch(fetchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    if (meta && meta.regularMarketPrice) {
                        console.log(`[API Quotes] HTTP Fallback success for ${symbol}: ${meta.regularMarketPrice}`);
                        return meta.regularMarketPrice;
                    }
                } else {
                    console.warn(`[API Quotes] HTTP Fallback status ${res.status} for ${symbol}`);
                }
            } catch (fallbackError) {
                console.error(`[API Quotes] HTTP Fallback error for ${symbol}`, fallbackError);
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

    console.log(`[API Quotes] Returning result: ${JSON.stringify(result)}`);
    return response.status(200).json(result);
  } catch (error: any) {
    console.error("[API Quotes] Critical Error:", error);
    // Always return 200 with empty object on crash to prevent frontend 500
    return response.status(200).json({});
  }
}
