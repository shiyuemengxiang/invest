
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
        // 1. CN Stocks (Tencent API): sz000001, sh600519, bj839725
        if (/^(sh|sz|bj)\d{6}$/i.test(symbol)) {
            try {
                const res = await fetch(`https://qt.gtimg.cn/q=${symbol}`, {
                    headers: { 'Referer': 'https://gu.qq.com/' }
                });
                const text = await res.text();
                // Response format: v_sz000001="51~Name~Code~CurrentPrice~..."
                // Price is usually index 3
                const parts = text.split('~');
                if (parts.length > 3) {
                    const price = parseFloat(parts[3]);
                    console.log(`[API Quotes] Tencent success for ${symbol}: ${price}`);
                    return price;
                }
            } catch (e: any) {
                console.warn(`[API Quotes] Tencent failed for ${symbol}: ${e.message}`);
            }
            return null;
        }

        // 2. CN Funds (EastMoney API): 6 digits (e.g. 320007)
        if (/^\d{6}$/.test(symbol)) {
            try {
                // Use http/https based on availability. Node fetch supports both.
                const res = await fetch(`http://fundgz.1234567.com.cn/js/${symbol}.js?rt=${Date.now()}`, {
                    headers: { 'Referer': 'http://fund.eastmoney.com/' }
                });
                const text = await res.text();
                // Response: jsonpgz({"fundcode":"...","gsz":"1.2345",...});
                const match = text.match(/"gsz":"([\d.]+)"/);
                if (match && match[1]) {
                    const price = parseFloat(match[1]);
                    console.log(`[API Quotes] EastMoney success for ${symbol}: ${price}`);
                    return price;
                }
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney failed for ${symbol}: ${e.message}`);
            }
            return null;
        }

        // 3. International (Yahoo Finance)
        try {
            // Suppress validation errors
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

    console.log(`[API Quotes] Returning result: ${JSON.stringify(result)}`);
    return response.status(200).json(result);
  } catch (error: any) {
    console.error("[API Quotes] Critical Error:", error);
    return response.status(200).json({});
  }
}
