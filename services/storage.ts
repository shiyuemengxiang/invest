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
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem(STORAGE_KEYS.DATA);
        return saved ? JSON.parse(saved) : null;
    },

    saveLocalData: (items: Investment[]) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(items));
    },

    getLocalUser: (): User | null => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem(STORAGE_KEYS.USER);
        return saved ? JSON.parse(saved) : null;
    },

    saveLocalUser: (user: User | null) => {
        if (typeof window === 'undefined') return;
        if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        else localStorage.removeItem(STORAGE_KEYS.USER);
    },

    getRates: (): ExchangeRates => {
        if (typeof window === 'undefined') return DEFAULT_EXCHANGE_RATES;
        const saved = localStorage.getItem(STORAGE_KEYS.RATES);
        return saved ? JSON.parse(saved) : DEFAULT_EXCHANGE_RATES;
    },

    saveRates: (rates: ExchangeRates) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
    },

    getTheme: (): ThemeOption => {
        if (typeof window === 'undefined') return 'slate';
        return (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeOption) || 'slate';
    },

    saveTheme: (theme: ThemeOption) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
    },

    // --- Cloud Sync Logic ---

    // Save Data: 🔥 恢复逻辑 - 只有登录用户才同步到云端
    async saveData(user: User | null, items: Investment[]) {
        // 1. 无论是否登录，总是存本地
        this.saveLocalData(items);
        
        // 2. 只有登录用户，才推送到云端
        if (user && user.id) {
            try {
                // console.log(`[Sync] Uploading data for user: ${user.id}`);
                const res = await fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, data: items })
                });
                
                if (!res.ok) {
                    console.error("云端同步失败:", await res.text());
                }
            } catch (e) {
                console.warn("Background sync failed:", e);
            }
        }
    },
    
    // Save Preferences
    async savePreferences(user: User | null, theme: ThemeOption, rates: ExchangeRates, rateMode?: 'auto' | 'manual', nickname?: string, avatar?: string) {
        this.saveTheme(theme);
        this.saveRates(rates);
        
        if (user && user.id) {
            try {
                const finalRateMode = rateMode || user?.preferences?.rateMode;
                const finalNickname = nickname !== undefined ? nickname : user?.preferences?.nickname;
                const finalAvatar = avatar !== undefined ? avatar : user?.preferences?.avatar;

                const prefs: UserPreferences = { 
                    theme, rates, rateMode: finalRateMode, nickname: finalNickname, avatar: finalAvatar
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

                // 登录成功后：
                // 如果是注册或本地有新数据，上传覆盖云端
                if (isRegister || currentItems.length > 0) {
                    await this.saveData(user, currentItems);
                } else {
                    // 否则拉取云端数据
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

    // 仅用于登录用户的拉取
    async syncDown(userId: string) {
        try {
            const res = await fetch(`${API_BASE}/investments?userId=${userId}`);
            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
                const json = await res.json();
                const data = Array.isArray(json) ? json : (json.data || []);
                if (Array.isArray(data)) {
                    // console.log('📥 从云端拉取数据成功:', data.length);
                    this.saveLocalData(data); // 更新本地缓存
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