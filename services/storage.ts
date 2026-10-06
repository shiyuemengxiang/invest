
import { ExchangeRates, Investment, ThemeOption, User, DEFAULT_EXCHANGE_RATES, UserPreferences, LedgerMeta } from "../types";

const STORAGE_KEYS = {
    DATA: 'smart_ledger_data',
    USER: 'smart_ledger_user',
    RATES: 'smart_ledger_rates',
    THEME: 'smart_ledger_theme',
    REV: 'smart_ledger_rev',
    TOKEN: 'smart_ledger_token'
};

const API_BASE = '/api';

// --- 同步安全错误类型 ---
export class SyncCliffError extends Error {
    stored: number;
    incoming: number;
    constructor(stored: number, incoming: number) {
        super(`云端有 ${stored} 条，本次仅 ${incoming} 条，已拦截覆盖`);
        this.name = 'SyncCliffError';
        this.stored = stored;
        this.incoming = incoming;
    }
}

export class SyncConflictError extends Error {
    serverRev: number;
    constructor(serverRev: number) {
        super('云端数据已被其他端更新，请先同步后再试');
        this.name = 'SyncConflictError';
        this.serverRev = serverRev;
    }
}

// 账号已被删除/禁用：服务端拒绝请求，客户端应强制退出登录（防僵尸会话）
export class AccountGoneError extends Error {
    reason: 'deleted' | 'disabled';
    constructor(reason: 'deleted' | 'disabled') {
        super(reason === 'deleted' ? '账号已被删除' : '账号已被禁用');
        this.name = 'AccountGoneError';
        this.reason = reason;
    }
}

// 登录态过期/无效：token 校验失败，客户端应强制重新登录
export class SessionExpiredError extends Error {
    constructor() {
        super('登录已过期，请重新登录');
        this.name = 'SessionExpiredError';
    }
}

// 登录时云端与本地都有真实数据，需要用户裁决
export interface LoginConflict {
    localCount: number;
    cloudCount: number;
    cloudUpdatedAt: string | null;
}

// 下载熔断阈值：本地>=15条 且 云端<50% 时拒绝覆盖本地
const DOWNLOAD_CLIFF_BASELINE = 15;
const DOWNLOAD_CLIFF_RATIO = 0.5;

// 同步状态（供 UI 显示"已同步 HH:MM / 同步失败"）
export interface SyncStatus {
    at: number;
    ok: boolean;
}

export const storageService = {
    // 最近一次同步状态（内存）
    _lastSync: null as SyncStatus | null,
    getLastSync: (): SyncStatus | null => storageService._lastSync,
    _setLastSync: (ok: boolean) => { storageService._lastSync = { at: Date.now(), ok }; },

    // --- Token 会话 ---
    getToken: (): string | null => localStorage.getItem(STORAGE_KEYS.TOKEN),
    saveToken: (token: string) => { localStorage.setItem(STORAGE_KEYS.TOKEN, token); },
    clearToken: () => { localStorage.removeItem(STORAGE_KEYS.TOKEN); },
    authHeaders: (): Record<string, string> => {
        const t = storageService.getToken();
        return t ? { 'Authorization': `Bearer ${t}` } : {};
    },
    // 统一处理鉴权类错误：token 失效 -> SessionExpiredError；账号删除/禁用 -> AccountGoneError
    throwIfAuthError: (res: Response, json: any) => {
        if (res.status === 401 && json.error === 'TOKEN_INVALID') {
            storageService._setLastSync(false);
            throw new SessionExpiredError();
        }
        if (res.status === 401 && json.error === 'USER_DELETED') {
            storageService._setLastSync(false);
            throw new AccountGoneError('deleted');
        }
        if (res.status === 403 && json.error === 'ACCOUNT_DISABLED') {
            storageService._setLastSync(false);
            throw new AccountGoneError('disabled');
        }
    },

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

    // --- Cloud Sync Logic（阶段一：防覆盖加固）---

    // --- seed 标记：演示数据只用于未登录展示，永不上传云端 ---
    isSeedItem: (item: Investment): boolean => !!item?.isSeed,
    stripSeed: (items: Investment[]): Investment[] => (items || []).filter(i => !i?.isSeed),
    hasRealData: (items: Investment[]): boolean => (items || []).some(i => !i?.isSeed),

    // --- rev 版本号（多端并发保护，存 localStorage） ---
    getLastRev: (): number | null => {
        const v = localStorage.getItem(STORAGE_KEYS.REV);
        return v === null ? null : Number(v);
    },
    setLastRev: (rev: number) => {
        localStorage.setItem(STORAGE_KEYS.REV, String(rev));
    },

    // Save Data: 本地全量保存；登录用户上传云端（去 seed、防骤降、防并发覆盖）
    // 服务端 422/409 会抛 SyncCliffError / SyncConflictError，由调用方 UI 处理
    async saveData(user: User | null, items: Investment[], opts?: { forceClear?: boolean }) {
        this.saveLocalData(items);
        if (user && user.id) {
            try {
                // 演示数据永不上传
                const clean = this.stripSeed(items);
                const baseRev = this.getLastRev();
                const res = await fetch(`${API_BASE}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
                    body: JSON.stringify({
                        userId: user.id,
                        data: clean,
                        ...(baseRev !== null ? { baseRev } : {}),
                        ...(opts?.forceClear ? { forceClear: true } : {})
                    })
                });
                const json = await res.json().catch(() => ({}));
                // 鉴权类错误：token 失效 / 账号删除 / 禁用 -> 抛给上层强制登出
                this.throwIfAuthError(res, json);
                if (res.status === 422 && json.error === 'DATA_CLIFF') {
                    this._setLastSync(false);
                    throw new SyncCliffError(json.stored || 0, json.incoming || 0);
                }
                if (res.status === 409 && json.error === 'CONFLICT') {
                    this._setLastSync(false);
                    throw new SyncConflictError(json.serverRev || 0);
                }
                if (!res.ok) {
                    console.error("云端同步失败:", res.status, json);
                    this._setLastSync(false);
                    return;
                }
                if (typeof json.rev === 'number') this.setLastRev(json.rev);
                this._setLastSync(true);
            } catch (e) {
                if (e instanceof SessionExpiredError || e instanceof AccountGoneError || e instanceof SyncCliffError || e instanceof SyncConflictError) throw e;
                console.warn("Background sync failed:", e);
                this._setLastSync(false);
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
                    headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
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

    // Login: 登录/注册。返回 { user, conflict }。
    // conflict 非空表示云端与本地都有真实数据，需要用户裁决 —— 绝不静默覆盖任一边。
    async login(
        email: string, password: string, isRegister: boolean, currentItems: Investment[]
    ): Promise<{ user: User; conflict: LoginConflict | null }> {
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
                if (data.token) this.saveToken(data.token);
                
                // Apply User Preferences if available
                if (user.preferences) {
                    if (user.preferences.theme) this.saveTheme(user.preferences.theme);
                    if (user.preferences.rates) this.saveRates(user.preferences.rates);
                }
                if (user.ledgerMeta && typeof user.ledgerMeta.rev === 'number') {
                    this.setLastRev(user.ledgerMeta.rev);
                }

                const hasRealLocal = this.hasRealData(currentItems);

                if (isRegister) {
                    // 注册：新账号。本地有真实数据则上传（游客迁移），否则下载（一般为空）
                    if (hasRealLocal) {
                        await this.saveData(user, currentItems);
                        // Also save current theme/rates as default for new user
                        await this.savePreferences(user, this.getTheme(), this.getRates());
                    } else {
                        await this.syncDown(user.id);
                    }
                    return { user, conflict: null };
                }

                // 登录：按云端基线裁决同步方向
                const meta: LedgerMeta | null | undefined = user.ledgerMeta;
                const cloudCount = meta?.count || 0;

                if (cloudCount === 0) {
                    // 云端无数据：上传本地真实数据（游客迁移）；本地也无则下载（空）
                    if (hasRealLocal) await this.saveData(user, currentItems);
                    else await this.syncDown(user.id);
                    return { user, conflict: null };
                }
                if (!hasRealLocal) {
                    // 本地只有 seed/空：下载云端
                    await this.syncDown(user.id);
                    return { user, conflict: null };
                }
                // 双方都有真实数据：交给用户裁决，绝不静默覆盖
                return {
                    user,
                    conflict: {
                        localCount: this.stripSeed(currentItems).length,
                        cloudCount,
                        cloudUpdatedAt: meta?.updatedAt || null
                    }
                };
            } else {
                throw new Error(data.error || 'Authentication failed');
            }
        } catch (e: any) {
            console.warn("API Login failed:", e);
            throw e; 
        }
    },

    // 用户在登录冲突弹窗中做出选择后调用
    async resolveLoginConflict(user: User, choice: 'cloud' | 'local', currentItems: Investment[]) {
        if (choice === 'cloud') {
            await this.syncDown(user.id, { force: true });
        } else {
            // 用户已二次确认：用本地覆盖云端
            await this.saveData(user, currentItems, { forceClear: true });
        }
    },

    // syncDown: 下载云端并覆盖本地（带熔断 + 防缓存）。
    // 返回下载的数据；熔断/失败时返回 null（本地不动）。
    async syncDown(userId: string, opts?: { force?: boolean }): Promise<Investment[] | null> {
        try {
            // 时间戳 + no-cache 头：防止浏览器/CDN 缓存旧数据
            const url = `${API_BASE}/investments?userId=${userId}&t=${Date.now()}`;
            const res = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    ...this.authHeaders()
                }
            });
            const contentType = res.headers.get('content-type');
            // 鉴权类错误：token 失效 / 账号删除 / 禁用 -> 抛给上层强制登出（先于 res.ok 判断）
            if (res.status === 401 || res.status === 403) {
                const errJson = await res.json().catch(() => ({}));
                this.throwIfAuthError(res, errJson);
            }
            if (res.ok && contentType && contentType.includes('application/json')) {
                const json = await res.json();
                const data = Array.isArray(json) ? json : (json.data || []);
                if (Array.isArray(data)) {
                    // 下载熔断：云端数据骤降时拒绝覆盖本地
                    if (!opts?.force) {
                        const local = this.getLocalData();
                        if (local && local.length >= DOWNLOAD_CLIFF_BASELINE
                            && data.length < local.length * DOWNLOAD_CLIFF_RATIO) {
                            console.error(
                                `[CRITICAL] syncDown 熔断：本地 ${local.length} 条，云端仅 ${data.length} 条，拒绝覆盖本地`
                            );
                            this._setLastSync(false);
                            return null;
                        }
                    }
                    this.saveLocalData(data);
                    const revHeader = res.headers.get('X-Ledger-Rev');
                    if (revHeader !== null && revHeader !== '') this.setLastRev(Number(revHeader));
                    this._setLastSync(true);
                    return data;
                }
            }
        } catch (e) {
            if (e instanceof SessionExpiredError || e instanceof AccountGoneError) throw e;
            console.warn("Could not sync down data:", e);
        }
        return null;
    },

    logout() {
        const token = this.getToken();
        // 通知服务端删除 session（尽力而为，不阻塞）
        if (token) {
            fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => {});
        }
        this.saveLocalUser(null);
        this.clearToken();
        // 版本号按账号隔离：退出时清除，防止旧账号的 rev 污染新账号（曾导致重注册后误报 409）
        localStorage.removeItem(STORAGE_KEYS.REV);
    }
};
