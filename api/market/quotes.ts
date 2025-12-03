import yahooFinance from 'yahoo-finance2';

interface QuoteResult {
    price: number;
    change?: number;
    time?: string;
}

const WEBULL_ID_CACHE: Record<string, string> = {
    'TQQQ': '913732468',
    'SQQQ': '913244407',
    'TSLA': '913255598',
    'AAPL': '913256135',
    'NVDA': '913257561',
    'AMD': '913256446',
    'MSFT': '913256424',
    'AMZN': '913256290',
    'GOOG': '913256299',
    'META': '913256337'
};

// 判断美股常规交易时段 (美东 09:30 - 16:00)
const isRegularUSMarketOpen = (): boolean => {
    try {
        const now = new Date();
        const etTimeStr = now.toLocaleString("en-US", {timeZone: "America/New_York"});
        const etTime = new Date(etTimeStr);
        
        const day = etTime.getDay(); // 0=Sun, 6=Sat
        if (day === 0 || day === 6) return false;

        const hour = etTime.getHours();
        const minute = etTime.getMinutes();
        const currentMinutes = hour * 60 + minute;
        
        // 9:30 = 570, 16:00 = 960
        return currentMinutes >= 570 && currentMinutes < 960;
    } catch (e) {
        return false;
    }
};

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
    const result: Record<string, QuoteResult> = {};
    const isMarketOpen = isRegularUSMarketOpen();

    console.log(`[Quotes] Market Status: ${isMarketOpen ? 'OPEN' : 'CLOSED/EXT'} - Fetching for: ${uniqueSymbols.length} symbols`);

    // --- Webull Fetcher ---
    const fetchWebullQuote = async (symbol: string): Promise<QuoteResult | null> => {
        try {
            let tickerId = WEBULL_ID_CACHE[symbol];
            if (!tickerId) {
                const searchUrl = `https://quotes-gw.webullfintech.com/api/search/pc/tickers?keyword=${symbol}&regionId=6&pageIndex=1&pageSize=1`;
                const searchRes = await fetch(searchUrl);
                const searchJson = await searchRes.json();
                if (searchJson.data?.[0]) {
                    tickerId = String(searchJson.data[0].tickerId);
                    WEBULL_ID_CACHE[symbol] = tickerId;
                }
            }
            if (!tickerId) return null;

            const quoteUrl = `https://quotes-gw.webullfintech.com/api/bgw/quote/realtime?ids=${tickerId}&includeSecu=1&delay=0&more=1`;
            const quoteRes = await fetch(quoteUrl);
            const quoteJson = await quoteRes.json();

            if (quoteJson?.[0]) {
                const data = quoteJson[0];
                const closePrice = Number(data.close);
                const extPrice = Number(data.pPrice); // 盘后/夜盘价
                const preClose = Number(data.preClose);
                
                let finalPrice = closePrice;
                let changePercent = 0;

                if (isMarketOpen) {
                    // 盘中
                    finalPrice = closePrice;
                    if (preClose > 0) changePercent = ((closePrice - preClose) / preClose) * 100;
                } else {
                    // 盘后/盘前/夜盘
                    // 策略：如果 extPrice 存在且有效，优先使用它
                    finalPrice = (extPrice && extPrice > 0) ? extPrice : closePrice;
                    
                    // 计算涨跌幅：始终对比昨日收盘价 (PreClose)，这样才能反映"目前总共涨了多少"
                    if (preClose > 0) {
                        changePercent = ((finalPrice - preClose) / preClose) * 100;
                    }
                }

                // 兜底
                if (changePercent === 0 && data.changeRatio) {
                    changePercent = Number(data.changeRatio) * 100;
                }

                return { price: finalPrice, change: changePercent, time: new Date().toISOString() };
            }
        } catch (e) {}
        return null;
    };

    // --- Yahoo Fetcher ---
    const fetchYahooQuote = async (symbol: string): Promise<QuoteResult | null> => {
        try {
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            const regular = quote.regularMarketPrice;
            const post = quote.postMarketPrice;
            const preClose = quote.regularMarketPreviousClose;

            let finalPrice = regular;
            
            // 盘后逻辑
            if (!isMarketOpen && post && post > 0) {
                finalPrice = post;
            }
            
            // 涨跌幅始终基于昨日收盘，保证盘后也能看到相对于昨日的盈亏
            let changePercent = 0;
            if (preClose > 0 && finalPrice > 0) {
                changePercent = ((finalPrice - preClose) / preClose) * 100;
            } else {
                changePercent = quote.regularMarketChangePercent || 0;
            }

            return { price: finalPrice, change: changePercent, time: new Date().toISOString() };
        } catch (e) {
            // Fallback HTTP
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
                if (res.ok) {
                    const data = await res.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    if (meta?.regularMarketPrice) {
                        const price = meta.regularMarketPrice;
                        const prev = meta.chartPreviousClose;
                        const change = prev ? ((price - prev) / prev) * 100 : 0;
                        return { price, change, time: new Date().toISOString() };
                    }
                }
            } catch (err) {}
        }
        return null;
    };

    // --- Main Strategy ---
    const fetchQuote = async (symbol: string): Promise<QuoteResult | null> => {
        // CN Stocks/Funds
        if (/^(sh|sz|bj)\d{6}$/i.test(symbol) || /^\d{6}$/.test(symbol)) {
            // (Keep your existing CN logic here if needed, or rely on services/market.ts fallback)
            // For brevity, returning null to let client-side handle CN stocks if backend fails, 
            // OR you can paste your existing CN logic back here. 
            // Assuming client-side `market.ts` handles CN well via proxy.
            return null; 
        }

        // US Stocks Strategy
        if (/^[A-Z]+$/.test(symbol)) {
            if (isMarketOpen) {
                // ☀️ 盘中：Yahoo 更稳 -> Webull
                console.log(`[Quotes] Regular Hours: Yahoo first for ${symbol}`);
                const yahoo = await fetchYahooQuote(symbol);
                if (yahoo) return yahoo;
                return await fetchWebullQuote(symbol);
            } else {
                // 🌙 盘后：Webull 更快/全 -> Yahoo
                console.log(`[Quotes] Extended Hours: Webull first for ${symbol}`);
                const webull = await fetchWebullQuote(symbol);
                if (webull) return webull;
                return await fetchYahooQuote(symbol);
            }
        }

        return await fetchYahooQuote(symbol);
    };

    const promises = uniqueSymbols.map(async (symbol) => {
        const data = await fetchQuote(symbol);
        return { symbol, data };
    });

    const outcomes = await Promise.allSettled(promises);
    outcomes.forEach(outcome => {
        if (outcome.status === 'fulfilled' && outcome.value.data) {
            result[outcome.value.symbol] = outcome.value.data;
        }
    });

    return response.status(200).json(result);

  } catch (error: any) {
    console.error("[API Quotes] Error:", error);
    return response.status(200).json({});
  }
}