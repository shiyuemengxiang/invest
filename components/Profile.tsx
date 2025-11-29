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

// ✨ 全新精选：AI 风格库定义 (用于替换 Dicebear 的选择器 UI)
// NOTE: 这里的 styleId 仍然映射到 Dicebear 风格，但 name/prompts 使用用户提供的详细描述。
const AVATAR_CATEGORIES = [
    {
        name: '卡通可爱风 (Q Version/Cute)',
        styleId: 'fun-emoji',
        prompts: [
            'Q 版卡通女孩头像，粉色短发带蝴蝶结，圆眼睛闪烁星星，穿着白色小熊图案卫衣，背景是淡蓝色渐变 + 白色云朵，线条简洁流畅，色彩明亮柔和，无复杂装饰，1:1 正方形，高清 1080P，透明背景',
            '胖嘟嘟橘色猫咪头像，耳朵内侧粉色，爪子搭着粉色小爱心，身体是几何图形拼接，背景是马卡龙色系（浅黄 + 浅粉），线条圆润无棱角，治愈系风格，适合用作聊天软件头像',
            '卡通男孩头像，蓝色短发，戴黑色棒球帽（帽檐反戴），穿着条纹 T 恤，嘴角上扬露齿笑，背景是简约黑色线条涂鸦，高饱和色彩（蓝 + 白 + 红），动态站姿，1:1 比例，高清无水印'
        ]
    },
    {
        name: '简约质感风 (Minimalist/Professional)',
        styleId: 'micah',
        prompts: [
            '职场女性简约头像，齐肩黑色短发，穿着黑色西装外套，面部线条干净利落，低饱和配色（灰 + 白 + 浅蓝），轻微阴影增强立体感，背景纯色（浅灰），专业商务气质，1:1 正方形，高清透明背景',
            '抽象人物头像，用圆形和直线组合表现轮廓，主体颜色是深蓝 + 金色点缀，线条利落无多余装饰，背景纯白色，极简主义风格，适合工作平台、简历头像',
            '男性简约头像，短发干净整洁，穿着白色衬衫，表情温和沉稳，背景是低饱和浅棕色渐变，光影柔和，无复杂元素，1:1 比例，高清细节，适配职业社交平台'
        ]
    },
    {
        name: '赛博朋克科技风 (Cyberpunk/Tech)',
        styleId: 'bottts',
        prompts: [
            '赛博朋克女孩头像，蓝紫色渐变短发，佩戴发光银色耳机，服装带有蓝色科技感线条装饰，背景是霓虹色网格纹理（蓝 + 紫 + 粉），高对比度色彩，面部带轻微荧光效果，1:1 正方形，高清 1080P',
            '机器人简约头像，主体是金属银色，眼睛和关节处有蓝色发光细节，身体是几何拼接结构，背景是黑色 + 紫色霓虹光效，线条硬朗利落，科技感十足，无多余装饰',
            '未来感女性头像，银色长发（带有渐变蓝挑染），戴透明科技眼镜（镜片显示数据流光效），穿着黑色紧身机甲外套，背景是未来城市夜景缩影，高饱和色彩，细节丰富（衣服纹理、发丝质感）'
        ]
    },
    {
        name: '复古怀旧风 (Retro/Nostalgia)',
        styleId: 'avataaars',
        prompts: [
            '复古港风女孩头像，波浪大卷发，穿着红色连衣裙，背景是简约格纹（红 + 棕），暖色调光线（偏黄），粗线条勾勒轮廓，面部妆容精致（红唇 + 柳叶眉），1:1 比例，怀旧质感',
            '老式相机元素头像，相机主体是浅咖色 + 黑色，镜头处有轻微反光，背景是复古牛皮纸纹理，细节简化（无多余按钮），怀旧风格，适合摄影账号、复古爱好者',
            '80 年代复古男孩头像，黑色中分长发，穿着白色衬衫 + 蓝色牛仔裤，背景是老式电视机雪花屏，暖黄色滤镜，线条略带颗粒感，复古胶片质感，1:1 正方形'
        ]
    },
    {
        name: '森系治愈风 (Nature/Healing)',
        styleId: 'adventurer',
        prompts: [
            '森系女孩头像，浅棕长发带花环（白色小花 + 绿叶），穿着棉麻材质米白色连衣裙，背景是简化绿色树叶图案，低饱和配色（绿 + 米白 + 浅棕），线条柔和，治愈系氛围，1:1 比例，透明背景',
            '小松鼠头像，抱着松果坐在树枝上，背景是浅绿色森林光斑，色彩柔和自然，线条圆润，无复杂细节，可爱治愈，适合游戏、生活分享账号',
            '文艺青年头像，齐肩长发（浅棕），穿着浅色针织衫，背景是木质纹理 + 绿植（尤加利叶），暖色调光线，柔和阴影，文艺清新风格，1:1 正方形，高清细节'
        ]
    },
    {
        name: '二次元动漫风 (Anime/2D)',
        styleId: 'lorelei',
        prompts: [
            '二次元少女头像，粉色双马尾，蓝色大眼睛（带高光），穿着洛丽塔风格连衣裙（粉 + 白），裙摆带蕾丝花边，背景是粉色樱花飘落，线条细腻，色彩明亮，动漫插画质感，1:1 比例，高清 1080P',
            '二次元少年头像，黑色短发，红色眼眸，穿着黑色校服外套，领口带白色条纹，背景是简约蓝色天空 + 白云，表情冷峻，线条锐利，动漫风格鲜明，适合游戏角色头像',
            '古风二次元头像，黑色长发（束成高马尾），穿着红色汉服（带金色刺绣），背景是水墨风格竹子，低饱和色彩（红 + 黑 + 灰），线条飘逸，古风韵味十足，1:1 正方形'
        ]
    },
    {
        name: '像素复古风 (8-Bit/Pixel)',
        styleId: 'pixel-art',
        prompts: [
            '8-bit 像素风女孩头像，粉色短发，穿着红色连衣裙，背景是像素化云朵 + 太阳，色彩鲜明（红 + 粉 + 蓝），16-bit 质感，无多余细节，1:1 比例，适配复古游戏、怀旧账号',
            '像素风猫咪头像，橘色身体，黑色条纹，背景是像素化绿色草地，色彩简洁（橘 + 黑 + 绿），8-bit 风格，线条清晰，适合用作游戏头像、社交账号',
            '像素风游戏角色头像，蓝色短发，穿着银色盔甲，手持剑，背景是像素化城堡轮廓，高饱和色彩（蓝 + 银 + 红），1:1 比例，复古游戏质感'
        ]
    },
    {
        name: '商务正式风 (Business/Formal)',
        styleId: 'personas',
        prompts: [
            '商务证件照风格头像，男性，短发整洁，穿着白色衬衫 + 蓝色领带，背景是纯色（浅蓝），表情温和沉稳，光线均匀无阴影，面部清晰无遮挡，1:1 比例，高清细节，适配职场平台、证件使用',
            '商务女性头像，齐肩短发，穿着白色西装外套，背景是纯色（浅灰），妆容淡雅，表情专业得体，光线柔和，无多余装饰，1:1 正方形，高清透明背景'
        ]
    }
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
        // NOTE: This function needs to be replaced with AI Image Generation call in the future
        const { seed } = getAvatarInfo();
        const bg = getRandomColor();
        const newAvatarUrl = `https://api.dicebear.com/9.x/${styleId}/svg?seed=${seed}&backgroundColor=${bg}`;
        setAvatar(newAvatarUrl);
        setShowAvatarSelector(false); 
        onNotify(`已切换至 ${AVATAR_CATEGORIES.find(c => c.styleId === styleId)?.name || '新'} 风格`, 'success');
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
                        {AVATAR_CATEGORIES.map(style => {
                            // 预览图使用当前种子 + 随机背景色
                            const { seed } = getAvatarInfo();
                            // 这里预览图为了好看，我们固定用一个比较通用的颜色，或者随机
                            const previewUrl = `https://api.dicebear.com/9.x/${style.styleId}/svg?seed=${seed}&backgroundColor=ffd5dc`;
                            const isSelected = avatar.includes(`/${style.styleId}/`);

                            return (
                                <button
                                    key={style.styleId}
                                    onClick={() => handleStyleSelect(style.styleId)}
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
                    <div className="mt-6 text-sm text-slate-500 border-t border-slate-100 pt-4">
                        💡 提示：当前使用 Dicebear 占位符。未来可在此集成 **AI 图像生成**，用上方详细的风格描述作为提示词 (Prompt)。
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