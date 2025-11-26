
import { ExchangeRates } from "../types";

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

    async getQuotes(symbols: string[]): Promise<Record<string, number> | null> {
        console.log(`[MarketService] Requesting quotes for: ${symbols.join(', ')}`);
        
        let result: Record<string, number> = {};
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

    async fetchClientSideQuotes(symbols: string[]): Promise<Record<string, number>> {
        const result: Record<string, number> = {};
        
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

                    const target = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        if (data && data.data && data.data.f43) {
                            return { symbol, price: data.data.f43 / 100 };
                        }
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney Stock fallback failed for ${symbol}`, e); }
                return null;
            }

            // B. CN Funds (EastMoney F10 Data)
            if (/^\d{6}$/.test(symbol)) {
                try {
                    // Use F10DataApi via proxy
                    const target = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${symbol}&page=1`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    
                    if (json.contents) {
                        // contents is the raw response body string from target
                        // It looks like: var apidata={ content:"..." };
                        // We need to parse inside that string.
                        
                        const contentMatch = json.contents.match(/content:"([^"]+)"/);
                        if (contentMatch && contentMatch[1]) {
                            const html = contentMatch[1];
                            // Parse HTML table row
                            const rowMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td><td[^>]*>([\d\.]+)<\/td>/);
                            if (rowMatch && rowMatch[2]) {
                                return { symbol, price: parseFloat(rowMatch[2]) };
                            }
                        }
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney Fund fallback failed for ${symbol}`, e); }
                return null;
            }

            // C. Yahoo Finance (International)
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            
            try {
                const proxyUrlA = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                const resA = await fetch(proxyUrlA);
                if (resA.ok) {
                    const data = await resA.json();
                    const price = this.extractPriceFromChart(data);
                    if (price) return { symbol, price };
                }
            } catch (e) {}

            try {
                const proxyUrlB = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                const resB = await fetch(proxyUrlB);
                if (resB.ok) {
                    const json = await resB.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        const price = this.extractPriceFromChart(data);
                        if (price) return { symbol, price };
                    }
                }
            } catch (e) {}

            return null;
        });

        const outcomes = await Promise.allSettled(promises);
        outcomes.forEach(outcome => {
            if (outcome.status === 'fulfilled' && outcome.value) {
                result[outcome.value.symbol] = outcome.value.price;
            }
        });
        
        return result;
    },

    extractPriceFromChart(data: any): number | null {
        try {
            const meta = data?.chart?.result?.[0]?.meta;
            return meta?.regularMarketPrice || meta?.previousClose || null;
        } catch (e) {
            return null;
        }
    }
};
