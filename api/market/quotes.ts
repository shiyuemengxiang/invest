
import yahooFinance from 'yahoo-finance2';

interface QuoteResult {
    price: number;
    change?: number;
    time?: string;
}

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
    const result: Record<string, QuoteResult> = {};

    const fetchQuote = async (symbol: string): Promise<QuoteResult | null> => {
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
                
                const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43,f170`;
                
                const res = await fetch(url, {
                    headers: { 'Referer': 'https://eastmoney.com/' }
                });
                
                const json = await res.json();
                // f43: Price (fen), f170: Change (basis points, 100 = 1%)
                if (json && json.data && json.data.f43) {
                    const price = json.data.f43 / 100;
                    const change = json.data.f170 ? json.data.f170 / 100 : 0;
                    console.log(`[API Quotes] EastMoney Stock success for ${symbol}: ${price} (${change}%)`);
                    return { price, change, time: new Date().toISOString() };
                }
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney Stock failed for ${symbol}: ${e.message}`);
            }
            return null;
        }

        // 2. CN Funds (EastMoney): 6 digits (e.g. 320007)
        if (/^\d{6}$/.test(symbol)) {
            try {
                // Strategy A: fundgz (Real-time Estimate + Basic NAV info)
                const url = `https://fundgz.1234567.com.cn/js/${symbol}.js?rt=${Date.now()}`;
                const res = await fetch(url, {
                    headers: { 'Referer': 'https://fund.eastmoney.com/' }
                });
                const text = await res.text();
                // Format: jsonpgz({"fundcode":"320007",..."dwjz":"1.7680","gsz":"1.7692","gszzl":"0.07",...});
                
                const match = text.match(/jsonpgz\((.*?)\)/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    
                    // CRITICAL: Use 'dwjz' (Confirmed NAV) for Price.
                    if (data.dwjz && parseFloat(data.dwjz) > 0) {
                        const price = parseFloat(data.dwjz);
                        
                        // Parse 'gszzl' (Est Change %). If empty or invalid, set to undefined.
                        let change: number | undefined = undefined;
                        if (data.gszzl && data.gszzl !== "") {
                            const parsedChange = parseFloat(data.gszzl);
                            if (!isNaN(parsedChange)) {
                                change = parsedChange;
                            }
                        }

                        console.log(`[API Quotes] EastMoney Fund (NAV) success for ${symbol}: ${price} (Est Change: ${change}%)`);
                        return { price, change, time: data.gztime || new Date().toISOString() };
                    }
                }
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney Fund (fundgz) failed for ${symbol}: ${e.message}`);
            }

            // Strategy B: F10DataApi (Confirmed NAV Table) - Fallback if fundgz dwjz is missing
            try {
                const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${symbol}&page=1`;
                const res = await fetch(url);
                const text = await res.text();
                // var apidata={ content:"... <tr><td>2023-01-01</td><td class='tor bold'>1.2345</td>..." }
                
                // Extract First Row NAV - loosen regex for attributes
                const navMatch = text.match(/<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d\.]+)<\/td>/);
                if (navMatch && navMatch[2]) {
                    const price = parseFloat(navMatch[2]);
                    console.log(`[API Quotes] EastMoney Fund (F10) success for ${symbol}: ${price}`);
                    // Historical table does not have intraday valuation change, so change is undefined
                    return { price, change: undefined, time: navMatch[1] }; 
                }
            } catch (e: any) {
                console.warn(`[API Quotes] EastMoney Fund (F10) failed for ${symbol}: ${e.message}`);
            }

            return null;
        }

        // 3. International (Yahoo Finance)
        try {
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            const price = quote.regularMarketPrice || quote.ask || quote.bid;
            const change = quote.regularMarketChangePercent || 0;
            console.log(`[API Quotes] YahooLib success for ${symbol}: ${price}`);
            return { price, change, time: new Date().toISOString() };
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
                        
                        let percentChange = 0;
                        const prevClose = meta.chartPreviousClose || meta.previousClose;
                        if (prevClose && prevClose > 0) {
                            percentChange = ((meta.regularMarketPrice - prevClose) / prevClose) * 100;
                        }

                        return { 
                            price: meta.regularMarketPrice,
                            change: percentChange
                        };
                    }
                }
            } catch (fallbackError) {
                console.error(`[API Quotes] HTTP Fallback error for ${symbol}`, fallbackError);
            }
            return null;
        }
    };

    const promises = uniqueSymbols.map(async (symbol) => {
        const data = await fetchQuote(symbol);
        return { symbol, data };
    });

    const outcomes = await Promise.allSettled(promises);

    outcomes.forEach(outcome => {
        if (outcome.status === 'fulfilled' && outcome.value) {
            const { symbol, data } = outcome.value;
            if (data && data.price !== undefined && !isNaN(data.price)) {
                result[symbol] = data;
            }
        }
    });

    return response.status(200).json(result);
  } catch (error: any) {
    console.error("[API Quotes] Critical Error:", error);
    return response.status(200).json({});
  }
}
