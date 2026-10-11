
import React, { useState } from 'react';
import { storageService, LoginConflict } from '../services/storage';
import { User, Investment } from '../types';

interface Props {
    onLogin: (user: User) => void;
    onCancel: () => void;
    currentItems: Investment[];
}

interface PendingConflict extends LoginConflict {
    user: User;
}

const Auth: React.FC<Props> = ({ onLogin, onCancel, currentItems }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // 忘记密码流程
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    // 登录时云端与本地都有真实数据：等待用户裁决
    const [conflict, setConflict] = useState<PendingConflict | null>(null);

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const json = await res.json().catch(() => ({}));
            if (res.status === 429) {
                setError(json.message || '请求过于频繁，请稍后再试');
                return;
            }
            // 为防枚举：无论邮箱是否存在都显示已发送
            setForgotSent(true);
        } catch (err) {
            setError('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const result = await storageService.login(email, password, isRegister, currentItems);
            if (result.conflict) {
                // 双方都有数据：请用户选择，不静默覆盖任一边
                setConflict({ user: result.user, ...result.conflict });
                return;
            }
            onLogin(result.user);
        } catch (err: any) {
            let msg = err.message;

            // Translate backend error codes to Chinese
            if (msg === 'USER_NOT_FOUND' || msg === 'INVALID_PASSWORD' || msg === 'INVALID_CREDENTIALS') {
                msg = '账号或密码错误';
            } else if (msg === 'TOO_MANY_ATTEMPTS') {
                msg = '尝试次数过多，请稍后再试';
            } else if (msg === 'ACCOUNT_DISABLED') {
                msg = '账号已被禁用，请联系管理员';
            } else if (msg === 'EMAIL_EXISTS' || msg === 'This email is already registered.') {
                msg = '该邮箱已被注册，请直接登录';
            } else if (!msg || msg === 'Authentication failed') {
                msg = isRegister ? '注册失败，请稍后重试' : '登录失败，请稍后重试';
            }

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleUseCloud = async () => {
        if (!conflict) return;
        setLoading(true);
        try {
            await storageService.resolveLoginConflict(conflict.user, 'cloud', currentItems);
            onLogin(conflict.user);
        } catch (err: any) {
            setError('下载云端数据失败：' + (err?.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const handleUseLocal = async () => {
        if (!conflict) return;
        setLoading(true);
        try {
            await storageService.resolveLoginConflict(conflict.user, 'local', currentItems);
            onLogin(conflict.user);
        } catch (err: any) {
            setError('上传本地数据失败：' + (err?.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const handleCancelConflict = () => {
        // 取消登录：清除已存的登录态，停留在登录页
        storageService.logout();
        setConflict(null);
    };

    // 忘记密码视图（优先于登录表单和冲突面板）
    if (forgotMode) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">SL</div>
                        <h2 className="text-2xl font-bold text-slate-800">找回密码</h2>
                        <p className="text-slate-400 text-sm mt-2">输入注册邮箱，我们会发送密码重置链接（30 分钟内有效）</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                             <p className="text-sm text-red-600 font-medium break-words">{error}</p>
                        </div>
                    )}

                    {forgotSent ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <p className="text-sm text-emerald-700 font-medium">如果该邮箱已注册，重置链接已发送，请查收邮件（含垃圾箱）。</p>
                        </div>
                    ) : (
                        <form onSubmit={handleForgotSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">电子邮箱</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                                    placeholder="name@example.com"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95 disabled:opacity-70 mt-4"
                            >
                                {loading ? '发送中...' : '发送重置链接'}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setForgotMode(false); setForgotSent(false); setError(null); }}
                            className="text-sm text-slate-500 hover:text-slate-800 font-medium transition"
                        >
                            返回登录
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 冲突裁决面板
    if (conflict) {
        const cloudDate = conflict.cloudUpdatedAt
            ? new Date(conflict.cloudUpdatedAt).toLocaleString('zh-CN')
            : '未知时间';

    return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">!</div>
                        <h2 className="text-xl font-bold text-slate-800">检测到两边都有数据</h2>
                        <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                            云端有 <span className="font-bold text-slate-700">{conflict.cloudCount}</span> 条记录
                            （{cloudDate}更新），
                            本机有 <span className="font-bold text-slate-700">{conflict.localCount}</span> 条记录。
                            请选择保留哪一边，另一边将被覆盖。
                        </p>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={handleUseCloud}
                            disabled={loading}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition active:scale-95 disabled:opacity-70"
                        >
                            {loading ? '处理中...' : `使用云端数据（${conflict.cloudCount} 条）`}
                        </button>
                        <button
                            onClick={handleUseLocal}
                            disabled={loading}
                            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold transition active:scale-95 disabled:opacity-70"
                        >
                            {loading ? '处理中...' : `上传本地数据（${conflict.localCount} 条，会覆盖云端）`}
                        </button>
                        <button
                            onClick={handleCancelConflict}
                            disabled={loading}
                            className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition"
                        >
                            取消登录
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">SL</div>
                    <h2 className="text-2xl font-bold text-slate-800">{isRegister ? '注册账户' : '登录账户'}</h2>
                    <p className="text-slate-400 text-sm mt-2">
                        {isRegister ? '注册后，您当前的账本将同步至云端' : '登录后将比对云端与本机数据，如两边都有记录会请您选择'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                         <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <p className="text-sm text-red-600 font-medium break-words">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">电子邮箱</label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                            placeholder="name@example.com"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-slate-700">密码</label>
                            {!isRegister && (
                                <button
                                    type="button"
                                    onClick={() => { setForgotMode(true); setForgotSent(false); setError(null); }}
                                    className="text-xs text-slate-400 hover:text-slate-700 font-medium transition"
                                >
                                    忘记密码？
                                </button>
                            )}
                        </div>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                            placeholder="••••••••"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95 disabled:opacity-70 mt-4"
                    >
                        {loading ? '处理中...' : (isRegister ? '立即注册并同步' : '登 录')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsRegister(!isRegister); setError(null); }}
                        className="text-sm text-slate-500 hover:text-slate-800 font-medium transition"
                    >
                        {isRegister ? '已有账号? 去登录' : '没有账号? 去注册'}
                    </button>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                     <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600 transition">
                        暂不登录, 继续作为访客使用
                     </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
