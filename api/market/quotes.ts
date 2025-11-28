import yahooFinance from 'yahoo-finance2';

interface QuoteResult {
    price: number;
    change?: number;
    time?: string;
}

// 内存缓存：存储 Symbol 到 Webull TickerID 的映射
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

// 辅助函数：判断当前是否为美股常规交易时段 (美东时间 Mon-Fri 09:30 - 16:00)
const isRegularUSMarketOpen = (): boolean => {
    try {
        const now = new Date();
        // 转换为美东时间 (处理夏令时/冬令时)
        const etTimeStr = now.toLocaleString("en-US", {timeZone: "America/New_York"});
        const etTime = new Date(etTimeStr);
        
        const day = etTime.getDay(); // 0=Sun, 6=Sat
        const hour = etTime.getHours();
        const minute = etTime.getMinutes();

        // 1. 周末休市
        if (day === 0 || day === 6) return false;

        // 2. 时间判断 (09:30 - 16:00)
        // 9:30 = 9*60+30 = 570
        // 16:00 = 16*60 = 960
        const currentMinutes = hour * 60 + minute;
        return currentMinutes >= 570 && currentMinutes < 960;
    } catch (e) {
        // 如果环境不支持时区转换，默认返回 false (优先展示 Webull 数据，因为更全面)
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
    console.log(`[API Quotes] Received request for symbols: ${JSON.stringify(symbols)}`);
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return response.status(400).json({ error: 'Missing symbols array' });
    }

    const uniqueSymbols = Array.from(new Set(symbols as string[]));
    const result: Record<string, QuoteResult> = {};

    // --- Helper: Webull Fetcher Logic ---
    const fetchWebullQuote = async (symbol: string): Promise<QuoteResult | null> => {
        try {
            let tickerId = WEBULL_ID_CACHE[symbol];

            // 1. 如果缓存里没有 ID，先去 Webull 搜索
            if (!tickerId) {
                const searchUrl = `https://quotes-gw.webullfintech.com/api/search/pc/tickers?keyword=${symbol}&regionId=6&pageIndex=1&pageSize=1`;
                const searchRes = await fetch(searchUrl);
                const searchJson = await searchRes.json();
                
                if (searchJson.data && searchJson.data.length > 0) {
                    const match = searchJson.data[0];
                    // 简单校验：确保搜索结果的 symbol 和请求的一致 (忽略大小写)
                    if (match.symbol === symbol || match.disSymbol === symbol) {
                        tickerId = String(match.tickerId);
                        WEBULL_ID_CACHE[symbol] = tickerId; // 存入缓存
                    }
                }
            }

            if (!tickerId) return null;

            // 2. 用 ID 获取实时报价
            const quoteUrl = `https://quotes-gw.webullfintech.com/api/bgw/quote/realtime?ids=${tickerId}&includeSecu=1&delay=0&more=1`;
            const quoteRes = await fetch(quoteUrl);
            const quoteJson = await quoteRes.json();

            if (quoteJson && quoteJson[0]) {
                const data = quoteJson[0];
                const closePrice = Number(data.close); // 盘中最新价 或 盘后收盘价
                const extPrice = Number(data.pPrice);  // 盘前/盘后/夜盘价
                const preClose = Number(data.preClose); // 昨日收盘价

                // 核心逻辑：确定显示价格和基准价格
                let finalPrice = closePrice;
                let basePrice = preClose; 

                // 如果有扩展时段价格，且不等于收盘价，说明处于非交易时段
                if (extPrice && extPrice > 0 && extPrice !== closePrice) {
                    finalPrice = extPrice;
                    // 在扩展时段，为了显示"当前时段涨跌"，基准应改为最近一次收盘价
                    // 否则显示的会是 "日盘涨跌 + 夜盘涨跌" 的总和，容易让人困惑
                    if (closePrice > 0) basePrice = closePrice;
                }

                // 计算涨跌幅
                let changePercent = 0;
                if (basePrice > 0 && finalPrice > 0) {
                    changePercent = ((finalPrice - basePrice) / basePrice) * 100;
                } else if (data.changeRatio) {
                    changePercent = Number(data.changeRatio) * 100;
                }

                console.log(`[API Quotes] Webull ${symbol}: Price=${finalPrice}, Base=${basePrice}, Change=${changePercent.toFixed(2)}%`);
                return { 
                    price: finalPrice, 
                    change: changePercent, 
                    time: new Date().toISOString() 
                };
            }
        } catch (e: any) {
            console.warn(`[API Quotes] Webull failed for ${symbol}: ${e.message}`);
        }
        return null;
    };

    // --- Helper: Yahoo Fetcher Logic ---
    const fetchYahooQuote = async (symbol: string): Promise<QuoteResult | null> => {
        try {
            // 1. 库调用
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            
            const regular = quote.regularMarketPrice || quote.ask || quote.bid;
            const post = quote.postMarketPrice;
            const preClose = quote.regularMarketPreviousClose;

            let finalPrice = regular;
            let basePrice = preClose;

            // 智能判断：如果有盘后价且不同，视为盘后模式
            if (post && post > 0 && post !== regular) {
                finalPrice = post;
                if (regular > 0) basePrice = regular; // 基准改为收盘价
            }

            let changePercent = 0;
            if (finalPrice > 0 && basePrice > 0) {
                changePercent = ((finalPrice - basePrice) / basePrice) * 100;
            } else {
                changePercent = quote.regularMarketChangePercent || 0;
            }

            console.log(`[API Quotes] Yahoo ${symbol}: Price=${finalPrice}, Base=${basePrice}, Change=${changePercent.toFixed(2)}%`);
            return { price: finalPrice, change: changePercent, time: new Date().toISOString() };
        } catch (e: any) {
            // 2. HTTP Fallback (Yahoo V8 API)
            try {
                const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const res = await fetch(fetchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    if (meta && meta.regularMarketPrice) {
                        const price = meta.regularMarketPrice;
                        let change = 0;
                        const prevClose = meta.chartPreviousClose || meta.previousClose;
                        if (prevClose && prevClose > 0) {
                            change = ((price - prevClose) / prevClose) * 100;
                        }
                        return { price, change, time: new Date().toISOString() };
                    }
                }
            } catch (fallbackError) {}
        }
        return null;
    };

    // --- Main Fetch Strategy ---
    const fetchQuote = async (symbol: string): Promise<QuoteResult | null> => {
        // 1. CN Stocks (EastMoney): sh/sz/bj + 6 digits
        if (/^(sh|sz|bj)\d{6}$/i.test(symbol)) {
            try {
                const prefix = symbol.slice(0, 2).toLowerCase();
                const code = symbol.slice(2);
                let market = '0';
                if (prefix === 'sh') market = '1';
                else if (prefix === 'sz') market = '0';
                else if (prefix === 'bj') market = '0'; 
                
                const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43,f170`;
                const res = await fetch(url, { headers: { 'Referer': 'https://eastmoney.com/' } });
                const json = await res.json();
                if (json && json.data && json.data.f43) {
                    return { price: json.data.f43 / 100, change: json.data.f170 ? json.data.f170 / 100 : 0, time: new Date().toISOString() };
                }
            } catch (e) {}
            return null;
        }

        // 2. CN Funds (EastMoney): 6 digits
        if (/^\d{6}$/.test(symbol)) {
            try {
                const url = `https://fundgz.1234567.com.cn/js/${symbol}.js?rt=${Date.now()}`;
                const res = await fetch(url, { headers: { 'Referer': 'https://fund.eastmoney.com/' } });
                const text = await res.text();
                const match = text.match(/jsonpgz\((.*?)\)/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    if (data.dwjz && parseFloat(data.dwjz) > 0) {
                        let change: number | undefined = undefined;
                        if (data.gszzl) change = parseFloat(data.gszzl);
                        return { price: parseFloat(data.dwjz), change, time: data.gztime };
                    }
                }
            } catch (e) {}
            
            // F10 Fallback
            try {
                const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${symbol}&page=1`;
                const res = await fetch(url);
                const text = await res.text();
                const navMatch = text.match(/<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d\.]+)<\/td>/);
                if (navMatch && navMatch[2]) {
                    return { price: parseFloat(navMatch[2]), change: undefined, time: navMatch[1] }; 
                }
            } catch (e) {}
            return null;
        }

        // 3. US/International Stocks (智能切换逻辑)
        if (/^[A-Z]+$/.test(symbol)) {
            const isRegularHours = isRegularUSMarketOpen();
            
            if (isRegularHours) {
                // ☀️ 盘中 (Regular): 优先 Yahoo -> 失败则 Webull
                const yahooData = await fetchYahooQuote(symbol);
                if (yahooData) return yahooData;
                
                return await fetchWebullQuote(symbol);
            } else {
                // 🌙 盘后/夜盘 (Overnight): 优先 Webull -> 失败则 Yahoo
                const webullData = await fetchWebullQuote(symbol);
                if (webullData) return webullData;
                
                return await fetchYahooQuote(symbol);
            }
        }

        // 4. Default Fallback (如期权代码)
        return await fetchYahooQuote(symbol);
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