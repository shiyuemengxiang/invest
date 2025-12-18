import { ExchangeRates, Investment, ThemeOption, User, DEFAULT_EXCHANGE_RATES, UserPreferences } from "../types";

const STORAGE_KEYS = {
    DATA: 'smart_ledger_data',
    USER: 'smart_ledger_user',
    RATES: 'smart_ledger_rates',
    THEME: 'smart_ledger_theme'
};

const API_BASE = '/api';

export const storageService = {
    // --- Local Storage Helpers ---
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

    // --- Cloud Sync Logic (修复版) ---

    // Save Data: 增加错误处理和返回值
    async saveData(user: User | null, items: Investment[]): Promise<boolean> {
        this.saveLocalData(items); // 总是先存本地
        
        if (user) {
            try {
                const res = await fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    console.error("❌ Cloud Sync Failed:", errText);
                    return false; // 明确返回失败
                }
                console.log("✅ Cloud Sync Success");
                return true;
            } catch (e) {
                console.error("❌ Cloud Sync Network Error:", e);
                return false;
            }
        }
        return true; // 没登录也算“本地保存成功”
    },
    
    // Save Preferences
    async savePreferences(user: User | null, theme: ThemeOption, rates: ExchangeRates, rateMode?: 'auto' | 'manual', nickname?: string, avatar?: string) {
        this.saveTheme(theme);
        this.saveRates(rates);
        
        if (user) {
            try {
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
                
                await fetch(`${API_BASE}/market/preferences`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, preferences: prefs })
                });
                
                const updatedUser = { ...user, preferences: prefs };
                this.saveLocalUser(updatedUser);
            } catch (e) {
                console.warn("Preference sync failed:", e);
            }
        }
    },

    // Login
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
                throw new Error('Backend service unavailable.');
            }

            const data = await res.json();

            if (res.ok) {
                const user = data as User;
                this.saveLocalUser(user);
                
                if (user.preferences) {
                    if (user.preferences.theme) this.saveTheme(user.preferences.theme);
                    if (user.preferences.rates) this.saveRates(user.preferences.rates);
                }

                // 登录策略：如果本地有数据，强制覆盖云端（避免旧覆盖新）
                if (isRegister || currentItems.length > 0) {
                    await this.saveData(user, currentItems);
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
                
                // 只有云端有数据时才覆盖本地
                if (Array.isArray(data) && data.length > 0) {
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