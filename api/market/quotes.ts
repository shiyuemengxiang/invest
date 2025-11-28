import yahooFinance from 'yahoo-finance2';

interface QuoteResult {
    price: number;
    change?: number;
    time?: string;
}

// 内存缓存：存储 Symbol 到 Webull TickerID 的映射
// 修正策略：只预留最核心的几个，其他让程序自动搜索 (Auto-Discovery) 以免ID变动
// TQQQ ID 已更正为 913732468
const WEBULL_ID_CACHE: Record<string, string> = {
    'TQQQ': '913732468', // TQQQ
    'SQQQ': '913244407', // SQQQ
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
        const currentMinutes = hour * 60 + minute;
        const startMinutes = 9 * 60 + 30; // 09:30
        const endMinutes = 16 * 60;       // 16:00

        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch (e) {
        // 如果环境不支持时区转换，默认返回 false (偏向于使用 Webull，因为夜盘数据覆盖面更广)
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
    // console.log(`[API Quotes] Received request for symbols: ${JSON.stringify(symbols)}`);
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return response.status(400).json({ error: 'Missing symbols array' });
    }

    const uniqueSymbols = Array.from(new Set(symbols as string[]));
    const result: Record<string, QuoteResult> = {};

    // --- Helper: Webull Fetcher Logic (支持夜盘) ---
    const fetchWebullQuote = async (symbol: string): Promise<QuoteResult | null> => {
        try {
            let tickerId = WEBULL_ID_CACHE[symbol];

            // 1. 如果缓存里没有 ID，先去 Webull 搜索
            if (!tickerId) {
                // console.log(`[API Quotes] ID not cached for ${symbol}, searching...`);
                const searchUrl = `https://quotes-gw.webullfintech.com/api/search/pc/tickers?keyword=${symbol}&regionId=6&pageIndex=1&pageSize=1`;
                const searchRes = await fetch(searchUrl);
                const searchJson = await searchRes.json();
                
                if (searchJson.data && searchJson.data.length > 0) {
                    const match = searchJson.data[0];
                    // 简单校验：确保搜索结果的 symbol 和请求的一致 (忽略大小写)
                    if (match.symbol === symbol || match.disSymbol === symbol) {
                        tickerId = String(match.tickerId);
                        WEBULL_ID_CACHE[symbol] = tickerId; // 🔥 存入缓存，下次直接用
                        // console.log(`[API Quotes] Found & Cached ID for ${symbol}: ${tickerId}`);
                    }
                }
            }

            if (!tickerId) {
                // console.warn(`[API Quotes] Webull search failed to find ID for ${symbol}`);
                return null;
            }

            // 2. 用 ID 获取实时报价 (含夜盘 pPrice)
            // includeSecu=1, delay=0, more=1 是关键参数
            const quoteUrl = `https://quotes-gw.webullfintech.com/api/bgw/quote/realtime?ids=${tickerId}&includeSecu=1&delay=0&more=1`;
            const quoteRes = await fetch(quoteUrl);
            const quoteJson = await quoteRes.json();

            if (quoteJson && quoteJson[0]) {
                const data = quoteJson[0];
                
                // 价格逻辑：优先取 pPrice (盘前/盘后/夜盘)，如果无效则取 close
                const closePrice = Number(data.close);
                const extPrice = Number(data.pPrice);
                const preClose = Number(data.preClose); // 昨日收盘价
                
                const finalPrice = (extPrice && extPrice > 0) ? extPrice : closePrice;
                
                // 涨跌幅逻辑：强制手动计算 (当前价 - 昨收) / 昨收
                // 解决 "夜盘涨但显示跌" 的问题（因为接口原生的 pChange 可能是相对于今日收盘价的）
                let changePercent = 0;
                if (preClose > 0 && finalPrice > 0) {
                    changePercent = ((finalPrice - preClose) / preClose) * 100;
                } else if (data.pChange && extPrice > 0) {
                    changePercent = Number(data.pChange) * 100; // 兜底：Webull 返回 0.015 代表 1.5%
                } else if (data.changeRatio) {
                    changePercent = Number(data.changeRatio) * 100;
                }

                console.log(`[API Quotes] Webull ${symbol}: Price=${finalPrice}, PreClose=${preClose}, CalcChange=${changePercent.toFixed(2)}%`);
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
            // 1. 库调用：获取标准报价数据
            const quote = await yahooFinance.quote(symbol, { validateResult: false }) as any;
            
            const regularPrice = quote.regularMarketPrice || quote.ask || quote.bid;
            const postPrice = quote.postMarketPrice;
            const preClose = quote.regularMarketPreviousClose;

            // 优先使用盘后价格
            const finalPrice = (postPrice && postPrice > 0) ? postPrice : regularPrice;
            
            // 同样强制手动计算涨跌幅，保持口径一致
            let changePercent = 0;
            if (finalPrice > 0 && preClose > 0) {
                changePercent = ((finalPrice - preClose) / preClose) * 100;
            } else {
                changePercent = quote.regularMarketChangePercent || 0;
            }

            console.log(`[API Quotes] Yahoo ${symbol}: Price=${finalPrice}, PreClose=${preClose}, CalcChange=${changePercent.toFixed(2)}%`);
            return { price: finalPrice, change: changePercent, time: new Date().toISOString() };
        } catch (libError: any) {
            // console.warn(`[API Quotes] YahooLib failed for ${symbol}: ${libError.message}`);
            
            // HTTP Fallback logic for Yahoo
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
                        // HTTP 接口通常只返回常规时段价格
                        const price = meta.regularMarketPrice;
                        let change = 0;
                        const prevClose = meta.chartPreviousClose || meta.previousClose;
                        if (prevClose && prevClose > 0) {
                            change = ((price - prevClose) / prevClose) * 100;
                        }
                        return { price, change };
                    }
                }
            } catch (fallbackError) {
                // console.error(`[API Quotes] Yahoo HTTP Fallback error for ${symbol}`);
            }
        }
        return null;
    };

    // --- Main Fetch Strategy ---
    const fetchQuote = async (symbol: string): Promise<QuoteResult | null> => {
        // 1. CN Stocks (EastMoney): sh, sz, bj
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

        // 2. CN Funds (EastMoney)
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

        // 3. US/International Stocks (Dynamic Strategy)
        if (/^[A-Z]+$/.test(symbol)) {
            const isRegularHours = isRegularUSMarketOpen();
            
            if (isRegularHours) {
                // ☀️ 盘中 (Regular): 优先 Yahoo -> 失败则 Webull
                // Yahoo 在盘中数据延迟低，且稳定
                const yahooData = await fetchYahooQuote(symbol);
                if (yahooData) return yahooData;
                
                return await fetchWebullQuote(symbol);
            } else {
                // 🌙 盘后/夜盘 (Overnight): 优先 Webull -> 失败则 Yahoo
                // Webull 支持 Blue Ocean 夜盘数据，Yahoo 此时通常只有收盘价
                const webullData = await fetchWebullQuote(symbol);
                if (webullData) return webullData;
                
                return await fetchYahooQuote(symbol);
            }
        }

        // 4. Default Fallback (用于非纯字母代码，如期权 QQQ251226C...)
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