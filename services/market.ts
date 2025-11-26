
import { ExchangeRates } from "../types";

const API_BASE = '/api/market';

export const marketService = {
    async getRates(): Promise<ExchangeRates | null> {
        // Strategy 1: Try Backend API
        try {
            const res = await fetch(`${API_BASE}/rates`);
            if (res.ok) {
                const data = await res.json();
                if (data.USD && data.HKD) return data;
            }
        } catch (e) {
            console.warn("[MarketService] Backend rates API failed, switching to client-side fallback...", e);
        }

        // Strategy 2: Client-side Direct Fetch (open.er-api.com supports CORS)
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
        
        // Strategy 1: Try Backend API
        try {
            const res = await fetch(`${API_BASE}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            if (res.ok) {
                const data = await res.json();
                console.log("[MarketService] Backend API response:", data);
                if (Object.keys(data).length > 0) return data;
            }
        } catch (e) {
            console.warn("[MarketService] Backend quotes API failed/network error:", e);
        }

        // Strategy 2: Client-Side Fallback (Intelligent Routing)
        console.log("[MarketService] Triggering Client-Side Fallback...");
        
        const result: Record<string, number> = {};
        const uniqueSymbols = Array.from(new Set(symbols));

        const promises = uniqueSymbols.map(async (symbol) => {
            // A. CN Stocks (Tencent): sh, sz, bj
            if (/^(sh|sz|bj)\d{6}$/i.test(symbol)) {
                try {
                    // Use CORS Proxy because Tencent endpoint might not enable CORS for all origins or HTTP/S mix
                    const target = `https://qt.gtimg.cn/q=${symbol}`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    if (json.contents) {
                        const parts = json.contents.split('~');
                        if (parts.length > 3) return { symbol, price: parseFloat(parts[3]) };
                    }
                } catch (e) { console.warn(`[MarketService] Tencent fallback failed for ${symbol}`, e); }
                return null;
            }

            // B. CN Funds (EastMoney)
            if (/^\d{6}$/.test(symbol)) {
                try {
                    const target = `http://fundgz.1234567.com.cn/js/${symbol}.js`;
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
                    const json = await res.json();
                    if (json.contents) {
                        const match = json.contents.match(/"gsz":"([\d.]+)"/);
                        if (match && match[1]) return { symbol, price: parseFloat(match[1]) };
                    }
                } catch (e) { console.warn(`[MarketService] EastMoney fallback failed for ${symbol}`, e); }
                return null;
            }

            // C. Yahoo Finance (International)
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            
            // Try CorsProxy.io first
            try {
                const proxyUrlA = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                const resA = await fetch(proxyUrlA);
                if (resA.ok) {
                    const data = await resA.json();
                    const price = extractPriceFromChart(data);
                    if (price) return { symbol, price };
                }
            } catch (e) {}

            // Try AllOrigins second
            try {
                const proxyUrlB = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                const resB = await fetch(proxyUrlB);
                if (resB.ok) {
                    const json = await resB.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        const price = extractPriceFromChart(data);
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

        console.log("[MarketService] Final Combined Quotes:", result);
        return Object.keys(result).length > 0 ? result : null;
    }
};

function extractPriceFromChart(data: any): number | null {
    try {
        const meta = data?.chart?.result?.[0]?.meta;
        return meta?.regularMarketPrice || meta?.previousClose || null;
    } catch (e) {
        return null;
    }
}
