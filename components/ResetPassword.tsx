import React, { useState } from 'react';

interface Props {
    token: string;
    onDone: () => void;
}

// 邮件重置链接落地页：/?reset_token=xxx
const ResetPassword: React.FC<Props> = ({ token, onDone }) => {
    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pw1 !== pw2) { setError('两次输入的新密码不一致'); return; }
        if (pw1.length < 6) { setError('新密码至少 6 位'); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: pw1 })
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setDone(true);
            } else {
                setError(json.message || json.error || '重置失败');
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">SL</div>
                    <h2 className="text-2xl font-bold text-slate-800">设置新密码</h2>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                )}

                {done ? (
                    <div className="text-center">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
                            <p className="text-sm text-emerald-700 font-medium">密码已重置，请用新密码登录。</p>
                        </div>
                        <button
                            onClick={onDone}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95"
                        >
                            去登录
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">新密码</label>
                            <input
                                type="password" required value={pw1}
                                onChange={e => setPw1(e.target.value)}
                                placeholder="至少 6 位"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">确认新密码</label>
                            <input
                                type="password" required value={pw2}
                                onChange={e => setPw2(e.target.value)}
                                placeholder="再输入一次"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                            />
                        </div>
                        <button
                            type="submit" disabled={loading}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95 disabled:opacity-70 mt-4"
                        >
                            {loading ? '提交中...' : '确认重置'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
