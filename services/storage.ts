
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
                await fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                });
            } catch (e) {
                console.warn("Background sync failed:", e);
                // Silently fail for API issues, UI remains responsive
            }
        }
    },

    // Login: Tries Vercel API
    // Modified to accept currentItems. 
    // If Registering: Upload currentItems to cloud.
    // If Logging in: Download from cloud.
    async login(email: string, password: string, isRegister: boolean, currentItems: Investment[]): Promise<User> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for cold starts

            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, type: isRegister ? 'register' : 'login' }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Backend service unavailable. Please check your database connection.');
            }

            const data = await res.json();

            if (res.ok) {
                const user = data;
                this.saveLocalUser(user);
                
                if (isRegister && currentItems.length > 0) {
                    // SCENARIO 1: New Registration with existing Guest Data.
                    // Action: Push Guest Data to Cloud immediately.
                    await this.saveData(user, currentItems);
                } else {
                    // SCENARIO 2: Login or Registration without data.
                    // Action: Pull Data from Cloud.
                    await this.syncDown(user.id);
                }
                
                return user;
            } else {
                throw new Error(data.error || 'Authentication failed');
            }
        } catch (e: any) {
            console.warn("API Login failed:", e);
            throw e; 
        }
    },

    // Pull data from Vercel PG
    async syncDown(userId: string) {
        try {
            const res = await fetch(`${API_BASE}/investments?userId=${userId}`);
            
            // Validate JSON response
            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
                const json = await res.json();
                // Check if it's wrapped in {data: ...} or direct array
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
    }
};
