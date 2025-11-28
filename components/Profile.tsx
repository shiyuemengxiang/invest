import React, { useState, useEffect } from 'react';
import { Currency, ExchangeRates, ThemeOption, User } from '../types';
import { THEMES } from '../utils';
import { marketService } from '../services/market';
import { ToastType } from './Toast';

interface Props {
    user: User | null;
    rates: ExchangeRates;
    currentTheme: ThemeOption;
    onSaveRates: (rates: ExchangeRates, mode: 'auto' | 'manual') => void;
    onSaveTheme: (theme: ThemeOption) => void;
    onSaveProfile: (nickname: string, avatar: string) => void;
    onLogout: () => void;
    onNotify: (msg: string, type: ToastType) => void;
}

// ✨ 全新精选：可爱、多彩、高颜值风格库
const AVATAR_STYLES = [
    { id: 'fun-emoji', name: '开心表情 (Emoji)' },     // 超级可爱，色彩丰富
    { id: 'big-smile', name: '灿烂大笑 (Smile)' },     // 夸张表情，很有感染力
    { id: 'avataaars', name: '经典多彩 (Avatar)' },    // 最经典的彩色扁平风
    { id: 'bottts', name: '多彩机器人 (Bot)' },        // 颜色非常跳跃
    { id: 'lorelei', name: '二次元 (Lorelei)' },       // 唯美可爱风
    { id: 'adventurer', name: '冒险家 (Adventurer)' }, // 之前的默认，也不错
    { id: 'notionists', name: 'Notion 插画风' },       // 有质感的插画
    { id: 'croodles', name: '涂鸦 (Croodles)' },       // 艺术感涂鸦
    { id: 'thumbs', name: '拇指小人 (Thumbs)' },       // 呆萌风格
    { id: 'micah', name: 'Micah (简约)' },             // 虽然简约但线条很舒服
    { id: 'personas', name: 'Personas (现代)' },       // 现代扁平
    { id: 'pixel-art', name: '像素风 (8-Bit)' },       // 复古可爱
];

// 马卡龙色系背景池 (避免头像背景是透明或单调的灰色)
const BG_COLORS = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'fdcfaf', 'e6e6e6', 'd4e0ff', 'ffdfd3'
];

const Profile: React.FC<Props> = ({ user, rates, currentTheme, onSaveRates, onSaveTheme, onSaveProfile, onLogout, onNotify }) => {
    const [editRates, setEditRates] = useState<ExchangeRates>({...rates});
    const [rateMode, setRateMode] = useState<'auto' | 'manual'>(user?.preferences?.rateMode || 'manual');
    const [loadingRates, setLoadingRates] = useState(false);
    
    // Profile State
    const [nickname, setNickname] = useState(user?.preferences?.nickname || '');
    const [avatar, setAvatar] = useState(user?.preferences?.avatar || '');
    const [showAvatarSelector, setShowAvatarSelector] = useState(false);

    useEffect(() => {
        if (rateMode === 'auto') {
            fetchLiveRates();
        }
    }, [rateMode]);

    // 邮箱脱敏函数
    const maskEmail = (email: string) => {
        if (!email) return '';
        const [name, domain] = email.split('@');
        if (!name || !domain) return email;
        const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name}***`;
        return `${maskedName}@${domain}`;
    };

    const fetchLiveRates = async () => {
        setLoadingRates(true);
        const liveRates = await marketService.getRates();
        if (liveRates) {
            setEditRates(liveRates);
            onSaveRates(liveRates, 'auto');
        } else {
            onNotify("获取实时汇率失败，已切换回手动模式", "error");
            setRateMode('manual');
        }
        setLoadingRates(false);
    };

    const handleRateChange = (c: Currency, val: string) => {
        if (rateMode === 'auto') return;
        setEditRates(prev => ({ ...prev, [c]: parseFloat(val) || 0 }));
    };

    const handleSaveRates = () => {
        onSaveRates(editRates, rateMode);
        onNotify('汇率设置已保存', 'success');
    };

    // 随机获取一个好看的背景色
    const getRandomColor = () => BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];

    // 获取当前头像信息 (兼容旧版 URL)
    const getAvatarInfo = () => {
        const defaultStyle = 'fun-emoji'; // 默认改成最可爱的
        if (!avatar) return { style: defaultStyle, seed: Math.random().toString(36).substring(7) };
        try {
            // URL: https://api.dicebear.com/9.x/{style}/svg?seed={seed}&backgroundColor={color}
            const urlObj = new URL(avatar);
            const pathParts = urlObj.pathname.split('/');
            const style = pathParts[2] || defaultStyle;
            const seed = urlObj.searchParams.get('seed') || Math.random().toString(36).substring(7);
            return { style, seed };
        } catch (e) {
            return { style: defaultStyle, seed: Math.random().toString(36).substring(7) };
        }
    };

    // 1. 随机生成 (保持当前风格，换种子 + 换背景色)
    const handleRandomSeed = (e?: React.MouseEvent) => {
        e?.stopPropagation(); 
        const { style } = getAvatarInfo();
        const newSeed = Math.random().toString(36).substring(7);
        const bg = getRandomColor();
        // 关键点：追加 backgroundColor 参数
        const newAvatarUrl = `https://api.dicebear.com/9.x/${style}/svg?seed=${newSeed}&backgroundColor=${bg}`;
        setAvatar(newAvatarUrl);
    };

    // 2. 切换风格 (保持当前种子，换风格 + 换背景色)
    const handleStyleSelect = (styleId: string) => {
        const { seed } = getAvatarInfo();
        const bg = getRandomColor();
        const newAvatarUrl = `https://api.dicebear.com/9.x/${styleId}/svg?seed=${seed}&backgroundColor=${bg}`;
        setAvatar(newAvatarUrl);
        setShowAvatarSelector(false); 
    };

    const handleSaveUserProfile = () => {
        onSaveProfile(nickname, avatar);
        onNotify('个人信息已更新', 'success');
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in relative">
            
            {/* User Card */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative z-10">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Left: Avatar & Info */}
                    <div className="flex flex-col items-center gap-4 min-w-[120px]">
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                            title="点击切换头像风格"
                        >
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-md ${THEMES[currentTheme].button} border-4 border-white transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg`}>
                                {avatar ? (
                                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{user ? (nickname?.[0] || user.email[0]).toUpperCase() : 'G'}</span>
                                )}
                            </div>
                            
                            {/* Hover 提示 */}
                            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold text-white">换个风格</span>
                            </div>

                            {/* 随机按钮 */}
                            <button 
                                onClick={handleRandomSeed}
                                className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-md text-slate-500 hover:text-indigo-600 border border-slate-200 transition transform hover:scale-110 z-20"
                                title="随机生成样貌"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                        {user && (
                            <button onClick={onLogout} className="text-xs text-red-400 hover:text-red-600 font-medium transition">
                                退出登录
                            </button>
                        )}
                    </div>

                    {/* Right: Inputs */}
                    <div className="flex-1 w-full space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">账号 (Email)</label>
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono text-sm flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                                {user ? maskEmail(user.email) : '未登录 (访客模式)'}
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">昵称 (Nickname)</label>
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="给自己起个好听的名字"
                                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-200 outline-none transition"
                                />
                                <button 
                                    onClick={handleSaveUserProfile}
                                    className={`px-6 rounded-xl font-bold text-white shadow-md transition active:scale-95 ${THEMES[currentTheme].button}`}
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-fade-in-up relative z-20">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">选择你喜欢的风格</h3>
                        <button onClick={() => setShowAvatarSelector(false)} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {AVATAR_STYLES.map(style => {
                            // 预览图使用当前种子 + 随机背景色
                            const { seed } = getAvatarInfo();
                            // 这里预览图为了好看，我们固定用一个比较通用的颜色，或者随机
                            const previewUrl = `https://api.dicebear.com/9.x/${style.id}/svg?seed=${seed}&backgroundColor=ffd5dc`;
                            const isSelected = avatar.includes(`/${style.id}/`);

                            return (
                                <button
                                    key={style.id}
                                    onClick={() => handleStyleSelect(style.id)}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all border-2 group ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                                >
                                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm bg-white group-hover:scale-110 transition-transform">
                                        <img src={previewUrl} alt={style.name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className={`text-[10px] font-bold truncate w-full text-center ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>{style.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

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
                        <button onClick={handleSaveRates} className={`px-5 py-2 text-white text-sm font-bold rounded-xl shadow-md ${THEMES[currentTheme].button}`}>
                            保存汇率
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;