
import { ExchangeRates, Investment, ThemeOption, User, DEFAULT_EXCHANGE_RATES, UserPreferences } from "../types";

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

    // --- Cloud Sync Logic ---

    // Save Data: Uploads to Vercel PG if logged in, always saves to LocalStorage
    async saveData(user: User | null, items: Investment[]) {
        this.saveLocalData(items);
        if (user) {
            try {
                await fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                });
            } catch (e) {
                console.warn("Background sync failed:", e);
            }
        }
    },
    
    // Save Preferences: Uploads to Vercel PG if logged in, always saves to LocalStorage
    async savePreferences(user: User | null, theme: ThemeOption, rates: ExchangeRates, rateMode?: 'auto' | 'manual', nickname?: string, avatar?: string) {
        this.saveTheme(theme);
        this.saveRates(rates);
        
        if (user) {
            try {
                // Determine values: use argument if provided, else fallback to user's existing pref
                const finalRateMode = rateMode || user.preferences?.rateMode;
                const finalNickname = nickname !== undefined ? nickname : user.preferences?.nickname;
                const finalAvatar = avatar !== undefined ? avatar : user.preferences?.avatar;

                const prefs: UserPreferences = { 
                    theme, 
                    rates, 
                    rateMode: finalRateMode,
                    nickname: finalNickname,
                    avatar: finalAvatar
                };
                
                await fetch(`${API_BASE}/market/preferences`, { // NOTE: Verify API path in your setup, assumed /api/market/preferences based on previous context
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, preferences: prefs })
                });
                
                // Update local user object too
                const updatedUser = { ...user, preferences: prefs };
                this.saveLocalUser(updatedUser);
            } catch (e) {
                console.warn("Preference sync failed:", e);
            }
        }
    },

    // Login: Tries Vercel API
    async login(email: string, password: string, isRegister: boolean, currentItems: Investment[]): Promise<User> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
                const user = data as User;
                this.saveLocalUser(user);
                
                // Apply User Preferences if available
                if (user.preferences) {
                    if (user.preferences.theme) this.saveTheme(user.preferences.theme);
                    if (user.preferences.rates) this.saveRates(user.preferences.rates);
                }

                if (isRegister && currentItems.length > 0) {
                    await this.saveData(user, currentItems);
                    // Also save current theme/rates as default for new user
                    await this.savePreferences(user, this.getTheme(), this.getRates());
                } else {
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

    async syncDown(userId: string) {
        try {
            const res = await fetch(`${API_BASE}/investments?userId=${userId}`);
            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
                const json = await res.json();
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
