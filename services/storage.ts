
import { ExchangeRates, Investment, ThemeOption, User, DEFAULT_EXCHANGE_RATES } from "../types";

const STORAGE_KEYS = {
    DATA: 'smart_ledger_data',
    USER: 'smart_ledger_user',
    RATES: 'smart_ledger_rates',
    THEME: 'smart_ledger_theme'
};

const API_BASE = '/api';

export const storageService = {
    // --- Local Storage Helpers (Guest / Cache) ---
    getLocalData: (): Investment[] | null => {
        const saved = localStorage.getItem(STORAGE_KEYS.DATA);
        return saved ? JSON.parse(saved) : null;
    },

    saveLocalData: (items: Investment[]) => {
        localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(items));
    },

    getLocalUser: (): User | null => {
        const saved = localStorage.getItem(STORAGE_KEYS.USER);
        return saved ? JSON.parse(saved) : null;
    },

    saveLocalUser: (user: User | null) => {
        if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        else localStorage.removeItem(STORAGE_KEYS.USER);
    },

    getRates: (): ExchangeRates => {
        const saved = localStorage.getItem(STORAGE_KEYS.RATES);
        return saved ? JSON.parse(saved) : DEFAULT_EXCHANGE_RATES;
    },

    saveRates: (rates: ExchangeRates) => {
        localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
    },

    getTheme: (): ThemeOption => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeOption) || 'slate';
    },

    saveTheme: (theme: ThemeOption) => {
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
    },

    // --- Hybrid Cloud / Local Logic ---

    // Sync Data: Uploads to Vercel PG if logged in, always saves to LocalStorage
    async saveData(user: User | null, items: Investment[]) {
        // 1. Optimistic Local Save
        this.saveLocalData(items);

        // 2. Cloud Sync
        if (user) {
            try {
                // Expects an API route at /api/sync
                fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                }).catch(e => console.warn("Background sync failed (API might not be ready):", e));
            } catch (e) {
                // Silently fail for API issues, UI remains responsive
            }
        }
    },

    // Login: Tries Vercel API, falls back to Mock for demo/offline
    async login(email: string, password: string): Promise<User> {
        // 1. Try Real API Login
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for API check

            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const user = await res.json();
                this.saveLocalUser(user);
                
                // Fetch latest cloud data
                this.syncDown(user.id);
                
                return user;
            }
        } catch (e) {
            console.warn("API Login failed/unavailable, falling back to Local Mock.", e);
        }

        // 2. Fallback Mock Login (For Guest/Demo or when API is down)
        return new Promise<User>(resolve => {
            setTimeout(() => {
                const mockUser = { id: 'u_' + Math.floor(Math.random()*10000), email, name: email.split('@')[0] };
                this.saveLocalUser(mockUser);
                resolve(mockUser);
            }, 800);
        });
    },

    // Pull data from Vercel PG
    async syncDown(userId: string) {
        try {
            const res = await fetch(`${API_BASE}/investments?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    this.saveLocalData(data);
                    return data;
                }
            }
        } catch (e) {
            console.warn("Could not sync down data:", e);
        }
        return null;
    },

    logout() {
        this.saveLocalUser(null);
        // Optionally clear data, but keeping it for cache is often better UX
    }
};
