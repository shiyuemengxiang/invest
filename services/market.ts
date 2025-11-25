
import { ExchangeRates } from "../types";

const API_BASE = '/api/market';

export const marketService = {
    async getRates(): Promise<ExchangeRates | null> {
        // Strategy 1: Try Backend API
        try {
            const res = await fetch(`${API_BASE}/rates`);
            if (res.ok) {
                const data = await res.json();
                // Basic validation
                if (data.USD && data.HKD) return data;
            }
        } catch (e) {
            console.warn("Backend rates API failed, switching to client-side fallback...", e);
        }

        // Strategy 2: Client-side Direct Fetch (open.er-api.com supports CORS)
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/CNY');
            if (res.ok) {
                const data = await res.json();
                if (data && data.rates) {
                    // Invert logic: API gives 1 CNY = X USD. We need 1 USD = Y CNY.
                    // 1 CNY = 0.138 USD => 1 USD = 7.24 CNY
                    return {
                        CNY: 1,
                        USD: parseFloat((1 / data.rates.USD).toFixed(4)),
                        HKD: parseFloat((1 / data.rates.HKD).toFixed(4))
                    };
                }
            }
        } catch (e) {
            console.error("Client-side rates fallback failed", e);
        }

        return null;
    },

    async getQuotes(symbols: string[]): Promise<Record<string, number> | null> {
        // Strategy 1: Try Backend API
        try {
            const res = await fetch(`${API_BASE}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            if (res.ok) {
                const data = await res.json();
                // If we got some data, return it. If empty object, try fallback.
                if (Object.keys(data).length > 0) return data;
            }
        } catch (e) {
            console.warn("Backend quotes API failed, switching to client-side fallback...", e);
        }

        // Strategy 2: Client-side Proxy Fetch (Yahoo Finance via corsproxy.io)
        // This bypasses Vercel IP blocking by using the user's browser + a proxy
        const result: Record<string, number> = {};
        
        // Dedup symbols
        const uniqueSymbols = Array.from(new Set(symbols));

        const promises = uniqueSymbols.map(async (symbol) => {
            try {
                // Use the Chart API which is lighter and often open
                const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    const data = await res.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    const price = meta?.regularMarketPrice || meta?.previousClose;
                    if (price) {
                        return { symbol, price };
                    }
                }
            } catch (e) {
                console.warn(`Client-side quote fetch failed for ${symbol}`, e);
            }
            return null;
        });

        const outcomes = await Promise.allSettled(promises);
        outcomes.forEach(outcome => {
            if (outcome.status === 'fulfilled' && outcome.value) {
                result[outcome.value.symbol] = outcome.value.price;
            }
        });

        return Object.keys(result).length > 0 ? result : null;
    }
};
