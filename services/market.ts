
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
        
        // Strategy 1: Try Backend API (Often Blocked on Vercel Free Tier IP)
        try {
            const res = await fetch(`${API_BASE}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            if (res.ok) {
                const data = await res.json();
                console.log("[MarketService] Backend API response:", data);
                // If we got some data, return it.
                if (Object.keys(data).length > 0) return data;
            } else {
                console.warn(`[MarketService] Backend API returned status ${res.status}`);
            }
        } catch (e) {
            console.warn("[MarketService] Backend quotes API failed/network error:", e);
        }

        // Strategy 2: Client-Side Multi-Proxy Fallback
        console.log("[MarketService] Triggering Client-Side Multi-Proxy Fallback...");
        
        const result: Record<string, number> = {};
        const uniqueSymbols = Array.from(new Set(symbols));

        const promises = uniqueSymbols.map(async (symbol) => {
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            
            // Sub-Strategy A: corsproxy.io (Fastest)
            try {
                const proxyUrlA = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                console.log(`[MarketService] Proxy A Fetching: ${symbol}`);
                const resA = await fetch(proxyUrlA);
                if (resA.ok) {
                    const data = await resA.json();
                    const price = extractPriceFromChart(data);
                    if (price) {
                        console.log(`[MarketService] Proxy A Success for ${symbol}:`, price);
                        return { symbol, price };
                    }
                }
            } catch (e) {
                console.warn(`[MarketService] Proxy A failed for ${symbol}`, e);
            }

            // Sub-Strategy B: allorigins.win (Reliable Fallback)
            try {
                const proxyUrlB = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                console.log(`[MarketService] Proxy B Fetching: ${symbol}`);
                const resB = await fetch(proxyUrlB);
                if (resB.ok) {
                    const json = await resB.json();
                    if (json.contents) {
                        const data = JSON.parse(json.contents);
                        const price = extractPriceFromChart(data);
                        if (price) {
                            console.log(`[MarketService] Proxy B Success for ${symbol}:`, price);
                            return { symbol, price };
                        }
                    }
                }
            } catch (e) {
                console.warn(`[MarketService] Proxy B failed for ${symbol}`, e);
            }

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

// Helper to parse Yahoo Chart JSON
function extractPriceFromChart(data: any): number | null {
    try {
        const meta = data?.chart?.result?.[0]?.meta;
        return meta?.regularMarketPrice || meta?.previousClose || null;
    } catch (e) {
        return null;
    }
}
