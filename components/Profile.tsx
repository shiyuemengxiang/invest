
import React, { useState, useEffect } from 'react';
import { Currency, ExchangeRates, ThemeOption, User } from '../types';
import { THEMES } from '../utils';
import { marketService } from '../services/market';

interface Props {
    user: User | null;
    rates: ExchangeRates;
    currentTheme: ThemeOption;
    onSaveRates: (rates: ExchangeRates, mode: 'auto' | 'manual') => void;
    onSaveTheme: (theme: ThemeOption) => void;
    onLogout: () => void;
}

const Profile: React.FC<Props> = ({ user, rates, currentTheme, onSaveRates, onSaveTheme, onLogout }) => {
    const [editRates, setEditRates] = useState<ExchangeRates>({...rates});
    const [rateMode, setRateMode] = useState<'auto' | 'manual'>(user?.preferences?.rateMode || 'manual');
    const [loadingRates, setLoadingRates] = useState(false);

    useEffect(() => {
        if (rateMode === 'auto') {
            fetchLiveRates();
        }
    }, [rateMode]);

    const fetchLiveRates = async () => {
        setLoadingRates(true);
        const liveRates = await marketService.getRates();
        if (liveRates) {
            setEditRates(liveRates);
            // Auto-save if in auto mode
            onSaveRates(liveRates, 'auto');
        } else {
            alert("获取实时汇率失败，已切换回手动模式");
            setRateMode('manual');
        }
        setLoadingRates(false);
    };

    const handleRateChange = (c: Currency, val: string) => {
        if (rateMode === 'auto') return;
        setEditRates(prev => ({ ...prev, [c]: parseFloat(val) || 0 }));
    };

    const handleSave = () => {
        onSaveRates(editRates, rateMode);
        alert('设置已保存');
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* User Card */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${THEMES[currentTheme].button}`}>
                        {user ? user.email[0].toUpperCase() : 'G'}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{user ? user.email.split('@')[0] : '访客用户'}</h2>
                        <p className="text-slate-500 text-sm">{user ? '数据已同步至 Vercel Postgres' : '数据仅存储在本地浏览器'}</p>
                    </div>
                </div>
                {user && (
                    <button onClick={onLogout} className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition font-medium">
                        退出登录
                    </button>
                )}
            </div>

            {/* Theme Selection */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                 <h3 className="text-lg font-bold text-slate-800 mb-6">个性化皮肤 (Themes)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(Object.keys(THEMES) as ThemeOption[]).map(themeKey => (
                        <button
                            key={themeKey}
                            onClick={() => onSaveTheme(themeKey)}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${currentTheme === themeKey ? 'border-slate-800 bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}
                        >
                            <div className={`w-full h-12 rounded-lg shadow-sm ${THEMES[themeKey].sidebar}`}></div>
                            <span className="text-xs font-bold uppercase text-slate-500">{themeKey}</span>
                        </button>
                    ))}
                 </div>
            </div>

            {/* Exchange Rates */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                     <div>
                        <h3 className="text-lg font-bold text-slate-800">汇率设置 (Exchange Rates)</h3>
                        <p className="text-xs text-slate-400 mt-1">基准货币 CNY</p>
                     </div>
                     
                     <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setRateMode('auto')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${rateMode === 'auto' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            自动更新
                        </button>
                        <button 
                            onClick={() => setRateMode('manual')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${rateMode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                        >
                            手动设置
                        </button>
                     </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    {loadingRates && (
                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                            <span className="text-sm font-bold text-emerald-600 animate-pulse">更新汇率中...</span>
                        </div>
                    )}
                    {(['CNY', 'USD', 'HKD'] as Currency[]).map(c => (
                        <div key={c}>
                            <label className="block text-sm font-semibold text-slate-500 mb-2">1 {c} 等于</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editRates[c]}
                                    onChange={(e) => handleRateChange(c, e.target.value)}
                                    disabled={c === 'CNY' || rateMode === 'auto'}
                                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:ring-2 ${c === 'CNY' || rateMode === 'auto' ? 'opacity-60 cursor-not-allowed' : 'focus:ring-slate-300'}`}
                                />
                                {c === 'CNY' && <span className="absolute right-4 top-3 text-xs text-slate-400">基准</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {rateMode === 'manual' && (
                    <div className="mt-6 flex justify-end">
                        <button onClick={handleSave} className={`px-5 py-2 text-white text-sm font-bold rounded-xl shadow-md ${THEMES[currentTheme].button}`}>
                            保存汇率
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
