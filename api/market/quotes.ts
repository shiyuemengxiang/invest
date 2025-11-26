
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
        // 1. CN Stocks (EastMoney push2): sh000001, sz000001, bj839725
        if (/^(sh|sz|bj)\d{6}$/i.test(symbol)) {
            try {
                const prefix = symbol.slice(0, 2).toLowerCase();
                const code = symbol.slice(2);
                
                // Map prefix to secid market code: SH=1, SZ=0, BJ=0
                let market = '0';
                if (prefix === 'sh') market = '1';
                else if (prefix === 'sz') market = '0';
                else if (prefix === 'bj') market = '0'; 
                
                const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43`;
                
                const res = await fetch(url, {
                    headers: { 'Referer': 'https://eastmoney.com/' }
                });
                
                const json = await res.json();
                // Data format: { data: { f43: 1234 } } -> Price is 12.34
                if (json && json.data && json.data.f43) {
                    const rawPrice = json.data.f43;
                    const price = rawPrice / 100; // Convert Fen to Yuan
                    console.log(`[API Quotes] EastMoney Stock success for ${symbol}: ${price}`);
                    return price;
                }
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney Stock failed for ${symbol}: ${e.message}`);
            }
            return null;
        }

        // 2. CN Funds (EastMoney F10 Data): 6 digits (e.g. 320007)
        if (/^\d{6}$/.test(symbol)) {
            try {
                // Use F10DataApi for historical NAV list (Confirmed values)
                const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${symbol}&page=1`;
                const res = await fetch(url, {
                    headers: { 'Referer': 'https://fund.eastmoney.com/' }
                });
                const text = await res.text();
                // Format: var apidata={ content:"<table...><tr><td>2025-11-25</td><td class='tor bold'>1.7680</td>...</table>", ... };
                
                // Extract content string
                const contentMatch = text.match(/content:"([^"]+)"/);
                if (contentMatch && contentMatch[1]) {
                    const html = contentMatch[1];
                    // Regex to find first data row: Date cell followed by NAV cell
                    // <td>2023-01-01</td><td class='tor bold'>1.2345</td>
                    const rowMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td><td[^>]*>([\d\.]+)<\/td>/);
                    
                    if (rowMatch && rowMatch[2]) {
                        const price = parseFloat(rowMatch[2]);
                        const date = rowMatch[1];
                        console.log(`[API Quotes] EastMoney Fund (F10) success for ${symbol}: ${price} (${date})`);
                        return price;
                    }
                }
                
                console.warn(`[API Quotes] EastMoney Fund parsing failed for ${symbol}`);
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney Fund failed for ${symbol}: ${e.message}`);
            }
            return null;
        }

        // 3. International (Yahoo Finance)
        try {
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            const price = quote.regularMarketPrice || quote.ask || quote.bid;
            console.log(`[API Quotes] YahooLib success for ${symbol}: ${price}`);
            return price;
        } catch (libError: any) {
            console.warn(`[API Quotes] YahooLib failed for ${symbol}: ${libError.message}`);
            
            // HTTP Fallback for Yahoo
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
            if (price !== undefined && price !== null && !isNaN(price)) {
                result[symbol] = price;
            }
        }
    });

    return response.status(200).json(result);
  } catch (error: any) {
    console.error("[API Quotes] Critical Error:", error);
    return response.status(200).json({});
  }
}
