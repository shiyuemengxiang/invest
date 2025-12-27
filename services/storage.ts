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

    // Save Data: 仅登录用户同步
    async saveData(user: User | null, items: Investment[]) {
        this.saveLocalData(items);
        
        if (user && user.id) {
            try {
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

    // 🔥 核心修复：增加时间戳，强制不缓存
    async syncDown(userId: string) {
        try {
            // 添加 timestamp 防止浏览器/CDN 缓存
            const url = `${API_BASE}/investments?userId=${userId}&t=${Date.now()}`;
            
            const res = await fetch(url, {
                headers: { 
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/json')) {
                const json = await res.json();
                const data = Array.isArray(json) ? json : (json.data || []);
                if (Array.isArray(data)) {
                    console.log('📥 [Anti-Cache] 成功拉取云端最新数据');
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