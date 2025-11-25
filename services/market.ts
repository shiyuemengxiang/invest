
import { ExchangeRates } from "../types";

const API_BASE = '/api/market';

export const marketService = {
    async getRates(): Promise<ExchangeRates | null> {
        try {
            const res = await fetch(`${API_BASE}/rates`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.warn("Failed to fetch market rates", e);
        }
        return null;
    },

    async getQuotes(symbols: string[]): Promise<Record<string, number> | null> {
        try {
            const res = await fetch(`${API_BASE}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.warn("Failed to fetch quotes", e);
        }
        return null;
    }
};
