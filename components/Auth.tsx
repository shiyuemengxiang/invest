
import React, { useState } from 'react';
import { storageService } from '../services/storage';
import { User, Investment } from '../types';

interface Props {
    onLogin: (user: User) => void;
    onCancel: () => void;
    currentItems: Investment[];
}

const Auth: React.FC<Props> = ({ onLogin, onCancel, currentItems }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            // Pass currentItems to login to handle "Guest -> Cloud" data migration
            const user = await storageService.login(email, password, isRegister, currentItems);
            onLogin(user);
        } catch (err: any) {
            let msg = err.message;

            // Translate backend error codes to Chinese
            if (msg === 'USER_NOT_FOUND') {
                msg = '账号不存在，请先注册';
            } else if (msg === 'INVALID_PASSWORD') {
                msg = '账号或密码错误';
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

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">SL</div>
                    <h2 className="text-2xl font-bold text-slate-800">{isRegister ? '注册账户' : '登录账户'}</h2>
                    <p className="text-slate-400 text-sm mt-2">
                        {isRegister ? '注册后，您当前的账本将同步至云端' : '登录后，将从云端拉取您的数据'}
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
                        <label className="block text-sm font-semibold text-slate-700 mb-2">密码</label>
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
