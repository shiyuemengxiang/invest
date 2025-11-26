
import { ExchangeRates, MarketData } from "../types";

const API_BASE = '/api/market';

export const marketService = {
    async getRates(): Promise<ExchangeRates | null> {
        try {
            const res = await fetch(`${API_BASE}/rates`);
            if (res.ok) {
                const data = await res.json();
                if (data.USD && data.HKD) return data;
            }
        } catch (e) {
            console.warn("[MarketService] Backend rates API failed, switching to client-side fallback...", e);
        }

        try {
            console.log("[MarketService] Fetching rates from client-side fallback...");
            const res = await fetch('https://open.er-api.com/v6/latest/CNY');
            if (res.ok) {
                const data = await res.json();
                if (data && data.rates) {
                    return {
                        CNY: 1,
                        USD: parseFloat((1 / data.rates.USD).toFixed(4)),
                        HKD: parseFloat((1 / data.rates.HKD).toFixed(4))
                    };
                }
            }
        } catch (e) {
            console.error("[MarketService] Client-side rates fallback failed", e);
        }

        return null;
    },

    async getQuotes(symbols: string[]): Promise<Record<string, MarketData> | null> {
        console.log(`[MarketService] Requesting quotes for: ${symbols.join(', ')}`);
        
        let result: Record<string, MarketData> = {};
        const uniqueSymbols = Array.from(new Set(symbols));
        
        try {
            const res = await fetch(`${API_BASE}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: uniqueSymbols })
            });
            if (res.ok) {
                const backendData = await res.json();
                console.log("[MarketService] Backend API partial response:", backendData);
                result = { ...backendData };
            }
        } catch (e) {
            console.warn("[MarketService] Backend quotes API failed/network error:", e);
        }

        // Differential Backfill: Identify Missing Symbols
        const missingSymbols = uniqueSymbols.filter(sym => result[sym] === undefined || result[sym] === null);
        
        if (missingSymbols.length > 0) {
            console.log(`[MarketService] Backend missed ${missingSymbols.length} symbols. Triggering client-side fallback for:`, missingSymbols);
            const fallbackQuotes = await this.fetchClientSideQuotes(missingSymbols);
            result = { ...result, ...fallbackQuotes };
        } else {
            console.log("[MarketService] Backend returned all symbols. No fallback needed.");
        }

        return Object.keys(result).length > 0 ? result : null;
    },

    async fetchClientSideQuotes(symbols: string[]): Promise<Record<string, MarketData>> {
        const result: Record<string, MarketData> = {};
        
        const promises = symbols.map(async (symbol) => {
            // A. CN Stocks (EastMoney): sh, sz, bj
            if (/^(sh|sz|bj)\d{6}$/i.test(symbol)) {
                try {
                    const prefix = symbol.slice(0, 2).toLowerCase();
                    const code = symbol.slice(2);
                    let market = '0';
                    if (prefix === 'sh') market = '1';
                    else if (prefix === 'sz') market = '0';
                    else if (prefix === 'bj') market = '0';

                    const target = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43,f170`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        if (data && data.data && data.data.f43) {
                            return { 
                                symbol, 
                                data: {
                                    price: data.data.f43 / 100,
                                    change: data.data.f170 ? data.data.f170 / 100 : 0
                                }
                            };
                        }
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney Stock fallback failed for ${symbol}`, e); }
                return null;
            }

            // B. CN Funds (EastMoney fundgz)
            if (/^\d{6}$/.test(symbol)) {
                try {
                    // Strategy 1: fundgz via proxy (Preferred for simplicity if dwjz exists)
                    const target = `https://fundgz.1234567.com.cn/js/${symbol}.js?rt=${Date.now()}`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    
                    if (json.contents) {
                        const match = json.contents.match(/jsonpgz\((.*?)\)/);
                        if (match && match[1]) {
                            const data = JSON.parse(match[1]);
                            // USE dwjz (NAV) for Price, gszzl (Est) for Growth
                            if (data.dwjz) {
                                return { 
                                    symbol, 
                                    data: {
                                        price: parseFloat(data.dwjz),
                                        change: parseFloat(data.gszzl || '0'),
                                        time: data.gztime
                                    }
                                };
                            }
                        }
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney Fund (fundgz) fallback failed for ${symbol}`, e); }
                
                // Strategy 2: F10DataApi via proxy (Backup)
                try {
                    const target = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${symbol}&page=1`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    if (json.contents) {
                        const navMatch = json.contents.match(/<td>(\d{4}-\d{2}-\d{2})<\/td><td class='tor bold'>([\d\.]+)<\/td>/);
                         if (navMatch && navMatch[2]) {
                            return { 
                                symbol, 
                                data: {
                                    price: parseFloat(navMatch[2]),
                                    change: 0 // No intraday info from history table
                                }
                            };
                         }
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney Fund (F10) fallback failed for ${symbol}`, e); }
                
                return null;
            }

            // C. Yahoo Finance (International)
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            
            try {
                const proxyUrlA = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                const resA = await fetch(proxyUrlA);
                if (resA.ok) {
                    const data = await resA.json();
                    const info = this.extractPriceFromChart(data);
                    if (info) return { symbol, data: info };
                }
            } catch (e) {}

            try {
                const proxyUrlB = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                const resB = await fetch(proxyUrlB);
                if (resB.ok) {
                    const json = await resB.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        const info = this.extractPriceFromChart(data);
                        if (info) return { symbol, data: info };
                    }
                }
            } catch (e) {}

            return null;
        });

        const outcomes = await Promise.allSettled(promises);
        outcomes.forEach(outcome => {
            if (outcome.status === 'fulfilled' && outcome.value) {
                result[outcome.value.symbol] = outcome.value.data;
            }
        });
        
        return result;
    },

    extractPriceFromChart(data: any): MarketData | null {
        try {
            const meta = data?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice || meta?.previousClose;
            if (price) {
                // Calculate rough change % if not directly available
                let change = 0;
                if (meta.previousClose) {
                    change = ((price - meta.previousClose) / meta.previousClose) * 100;
                }
                return { price, change };
            }
            return null;
        } catch (e) {
            return null;
        }
    }
};
