
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
                fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                }).catch(e => console.warn("Background sync failed:", e));
            } catch (e) {
                // Silently fail for API issues, UI remains responsive
            }
        }
    },

    // Login: Tries Vercel API, falls back to Mock for demo/offline
    async login(email: string, password: string, isRegister: boolean = false): Promise<User> {
        // 1. Try Real API Login
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for API check (cold start)

            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, type: isRegister ? 'register' : 'login' }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const user = await res.json();
                this.saveLocalUser(user);
                
                // Fetch latest cloud data immediately
                await this.syncDown(user.id);
                
                return user;
            } else {
                throw new Error('Auth failed');
            }
        } catch (e) {
            console.warn("API Login failed, throwing error to UI.", e);
            throw e; 
        }
    },

    // Pull data from Vercel PG
    async syncDown(userId: string) {
        try {
            const res = await fetch(`${API_BASE}/investments?userId=${userId}`);
            if (res.ok) {
                const json = await res.json();
                // API returns { data: [...] } or just [...]
                const data = Array.isArray(json) ? json : (json.data || []);
                
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
