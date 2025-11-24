
import { ExchangeRates, Investment, ThemeOption, User, DEFAULT_EXCHANGE_RATES } from "../types";

const STORAGE_KEYS = {
    DATA: 'smart_ledger_data',
    USER: 'smart_ledger_user',
    RATES: 'smart_ledger_rates',
    THEME: 'smart_ledger_theme'
};

// Mock API endpoints - In a real Vercel setup, these would be fetch('/api/...')
// For this demo, we simulate the API delay and storage
const mockApi = {
    async sync(userId: string, data: any) {
        // In production: await fetch('/api/sync', { method: 'POST', body: JSON.stringify({ userId, data }) })
        console.log(`[DB] Syncing data for user ${userId} to Postgres...`);
        return new Promise(resolve => setTimeout(resolve, 500));
    },
    async login(email: string) {
        // In production: await fetch('/api/auth/login', ...)
        return new Promise<User>(resolve => setTimeout(() => resolve({ id: 'u_123', email, name: email.split('@')[0] }), 800));
    }
};

export const storageService = {
    // --- Local Storage (Guest) ---
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

    // --- Hybrid Logic ---
    async saveData(user: User | null, items: Investment[]) {
        if (user) {
            // If logged in, save to "DB" AND update local cache
            await mockApi.sync(user.id, items);
            this.saveLocalData(items); 
        } else {
            // Guest mode
            this.saveLocalData(items);
        }
    },

    async login(email: string, password: string): Promise<User> {
        // Simulating API login
        const user = await mockApi.login(email);
        this.saveLocalUser(user);
        return user;
    },

    logout() {
        this.saveLocalUser(null);
        // Optional: Clear data or keep it? Typically keep for cache or clear for security.
        // For this hybrid app, we might keep it or clear it. Let's keep rates/theme.
    }
};
