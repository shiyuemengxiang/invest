import React, { useState, useEffect } from 'react';
import { ExchangeRates, Investment, User, ViewState, ThemeOption, FilterType, ProductTypeFilter, CurrencyFilter, CategoryFilter, SortType } from './types';
import Dashboard from './components/Dashboard';
import InvestmentList from './components/InvestmentList';
import InvestmentForm from './components/InvestmentForm';
import CalendarView from './components/CalendarView';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Toast, { ToastType } from './components/Toast';
import { storageService } from './services/storage';
import { marketService } from './services/market';
import { THEMES, migrateInvestmentData } from './utils';

const App: React.FC = () => {
  const [items, setItems] = useState<Investment[]>([]);
  const [view, setView] = useState<ViewState>('dashboard');
  const [editingItem, setEditingItem] = useState<Investment | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [rates, setRates] = useState<ExchangeRates>(storageService.getRates());
  const [theme, setTheme] = useState<ThemeOption>('slate');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Sidebar Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [listFilter, setListFilter] = useState<FilterType>('all');
  const [listProductFilter, setListProductFilter] = useState<ProductTypeFilter>('all');
  const [listCurrencyFilter, setListCurrencyFilter] = useState<CurrencyFilter>('all');
  const [listCategoryFilter, setListCategoryFilter] = useState<CategoryFilter>('all');
  const [listSortType, setListSortType] = useState<SortType>('date-asc');
  const [listShowCustomDate, setListShowCustomDate] = useState(false);
  const [listCustomStart, setListCustomStart] = useState('');
  const [listCustomEnd, setListCustomEnd] = useState('');

  const showToast = (message: string, type: ToastType = 'success') => {
      setToast({ message, type });
  };

  const migrateAndSetItems = (rawItems: Investment[]) => {
      const migrated = rawItems.map(migrateInvestmentData);
      setItems(migrated);
  };

  useEffect(() => {
    const currentUser = storageService.getLocalUser();
    const currentTheme = storageService.getTheme();
    const currentRates = storageService.getRates();
    const localData = storageService.getLocalData();
    
    setUser(currentUser);
    setTheme(currentTheme);
    setRates(currentRates);

    let loadedItems: Investment[] = [];
    if (localData) {
        loadedItems = localData;
    } else if (!currentUser) {
        const seed: Investment[] = [
            { id: '1', name: '新手专享理财', category: 'Fixed', type: 'Fixed', currency: 'CNY', depositDate: '2023-10-01', maturityDate: '2023-11-01', withdrawalDate: '2023-11-02', principal: 50000, expectedRate: 3.5, realizedReturn: 145, rebate: 100, isRebateReceived: true, notes: '新人福利', transactions: [], currentPrincipal: 50000, totalCost: 50000, totalRealizedProfit: 145 },
            { id: '2', name: '稳健季季红', category: 'Deposit', type: 'Fixed', currency: 'CNY', depositDate: '2024-01-15', maturityDate: '2024-04-15', withdrawalDate: null, principal: 100000, expectedRate: 3.2, rebate: 200, isRebateReceived: false, notes: '银行定期', transactions: [], currentPrincipal: 100000, totalCost: 100000, totalRealizedProfit: 0 },
            { id: '3', name: '科技ETF基金', category: 'Fund', type: 'Floating', currency: 'CNY', depositDate: '2024-03-01', maturityDate: '', withdrawalDate: null, principal: 20000, expectedRate: undefined, currentReturn: 850, rebate: 0, isRebateReceived: false, notes: '长期持有', transactions: [], currentPrincipal: 20000, totalCost: 20000, totalRealizedProfit: 0 },
        ];
        loadedItems = seed;
    }
    
    loadedItems.sort((a, b) => new Date(a.depositDate).getTime() - new Date(b.depositDate).getTime());
    migrateAndSetItems(loadedItems);

    if (currentUser) {
        storageService.syncDown(currentUser.id).then(cloudData => {
            if (cloudData && Array.isArray(cloudData)) {
                 migrateAndSetItems(cloudData);
            }
        });

        if (currentUser.preferences?.rateMode === 'auto') {
             marketService.getRates().then(newRates => {
                 if (newRates) {
                     setRates(newRates);
                     storageService.saveRates(newRates);
                 }
             });
        }
    }
    
    setTimeout(() => {
        const hasAutoQuote = loadedItems.some(i => i.isAutoQuote && !i.withdrawalDate);
        if (hasAutoQuote) {
            handleRefreshMarketData(true); 
        }
    }, 1000);

  }, []);
  
  useEffect(() => {
      if (items.length > 0) {
          const shouldRefresh = items.some(i => i.isAutoQuote && !i.withdrawalDate && (!i.lastUpdate || (new Date().getTime() - new Date(i.lastUpdate).getTime() > 3600000))); 
          if (shouldRefresh) {
              handleRefreshMarketData(true); 
          }
      }
  }, [items.length]); 

  const saveItems = (newItems: Investment[]) => {
      setItems(newItems);
      storageService.saveData(user, newItems);
  };

  const handleSaveItem = (item: Investment) => {
    const updatedList = [...items];
    const index = updatedList.findIndex(i => i.id === item.id);
    if (index >= 0) updatedList[index] = { ...item, userId: user?.id };
    else updatedList.push({ ...item, userId: user?.id });
    
    saveItems(updatedList);
    setIsFormOpen(false); 
    setEditingItem(null);
    showToast('资产记录已保存');
  };

  const handleAddClick = () => {
      setEditingItem(null);
      setIsFormOpen(true);
  };

  const handleEditClick = (item: Investment) => {
      setEditingItem(item);
      setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    const updatedList = items.filter(i => i.id !== id);
    saveItems(updatedList);
    showToast('资产记录已删除', 'info');
  };

  const handleReorder = (dragIndex: number, hoverIndex: number) => {
      const updatedList = [...items];
      const draggedItem = updatedList[dragIndex];
      updatedList.splice(dragIndex, 1);
      updatedList.splice(hoverIndex, 0, draggedItem);
      saveItems(updatedList);
  };
  
  const handleRefreshMarketData = async (silent = false) => {
      const itemsToUpdate = items.filter(i => i.isAutoQuote && i.symbol && !i.withdrawalDate);
      if (itemsToUpdate.length === 0) {
          return;
      }
      const symbols = itemsToUpdate.map(i => i.symbol as string);
      
      const quotes = await marketService.getQuotes(symbols);
      
      let updatedCount = 0;
      if (quotes) {
          const updatedList = items.map(item => {
              if (item.isAutoQuote && item.symbol && quotes[item.symbol] && item.quantity) {
                  const marketData = quotes[item.symbol];
                  const newPrice = marketData.price;
                  const qty = item.currentQuantity || item.quantity || 0;
                  const currentVal = newPrice * qty;
                  const newReturn = currentVal - item.currentPrincipal; 
                  updatedCount++;
                  
                  return { 
                      ...item, 
                      currentReturn: newReturn,
                      estGrowth: marketData.change, 
                      lastUpdate: new Date().toISOString()
                  };
              }
              return item;
          });
          saveItems(updatedList);
      }
      
      if (user?.preferences?.rateMode === 'auto') {
           const newRates = await marketService.getRates();
           if (newRates) handleRatesChange(newRates, 'auto');
      }
      
      if (!silent && updatedCount > 0) showToast(`行情更新成功！已更新 ${updatedCount} 个资产`, 'success');
  };

  const handleLogin = (loggedInUser: User) => {
      setUser(loggedInUser);
      if (loggedInUser.preferences) {
          if (loggedInUser.preferences.theme) setTheme(loggedInUser.preferences.theme);
          if (loggedInUser.preferences.rates) setRates(loggedInUser.preferences.rates);
      }
      
      const freshData = storageService.getLocalData();
      if (freshData) migrateAndSetItems(freshData);

      setView('dashboard');
      showToast('欢迎回来！数据已同步', 'success');
  };

  const handleLogout = () => {
      storageService.logout();
      setUser(null);
      setView('auth');
      showToast('已安全退出', 'info');
  };

  const handleThemeChange = (newTheme: ThemeOption) => {
      setTheme(newTheme);
      storageService.savePreferences(user, newTheme, rates, user?.preferences?.rateMode);
  };

  const handleRatesChange = (newRates: ExchangeRates, mode?: 'auto' | 'manual') => {
      setRates(newRates);
      const currentMode = mode || user?.preferences?.rateMode || 'manual';
      if (user) {
         const updatedUser = { ...user, preferences: { ...user.preferences, rates: newRates, rateMode: currentMode } };
         setUser(updatedUser);
         storageService.saveLocalUser(updatedUser);
         storageService.savePreferences(user, theme, newRates, currentMode);
      } else {
         storageService.saveRates(newRates);
      }
  };

  const handleProfileUpdate = (nickname: string, avatar: string) => {
      if (user) {
          const updatedUser = { ...user, preferences: { ...user.preferences, nickname, avatar } };
          setUser(updatedUser);
          storageService.saveLocalUser(updatedUser);
          storageService.savePreferences(updatedUser, theme, rates, user.preferences?.rateMode, nickname, avatar);
      }
  };

  const handleNav = (targetView: ViewState) => {
      if (targetView === 'list' && view !== 'list') {
          setTimeout(() => handleRefreshMarketData(true), 500); 
      }
      setView(targetView);
      setIsMobileMenuOpen(false);
  };
  
  // 邮箱脱敏函数
  const maskEmail = (email: string) => {
      if (!email) return '';
      const [name, domain] = email.split('@');
      if (!name || !domain) return email;
      const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name}***`;
      return `${maskedName}@${domain}`;
  };

  const themeConfig = THEMES[theme];
  const isLightTheme = ['lavender', 'mint', 'sky', 'sakura', 'ivory'].includes(theme);
  
  const logoTextColor = isLightTheme ? 'text-slate-800' : 'text-white';
  const logoSubTextColor = isLightTheme ? 'text-slate-500' : 'text-white/50';
  const navIconColor = isLightTheme ? 'text-slate-500' : 'text-white/60';
  const profileBg = isLightTheme ? 'bg-slate-200/50 border-slate-200' : 'bg-white/10 border-white/5';
  const profileTextMain = isLightTheme ? 'text-slate-800' : 'text-white';
  const profileTextSub = isLightTheme ? 'text-slate-500 hover:text-slate-800' : 'text-white/60 hover:text-white';

  if (view === 'auth' && !user) {
      return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <Auth onLogin={handleLogin} onCancel={() => setView('dashboard')} currentItems={items} />
        </>
      );
  }

  // --- PC 端侧边栏 (现代化+折叠+皮肤跟随+隐私保护) ---
  const DesktopSidebar = () => {
      const sidebarWidth = isSidebarCollapsed ? 'w-24' : 'w-72';
      
      return (
      <div className={`hidden md:flex flex-col ${sidebarWidth} h-[calc(100vh-2rem)] sticky top-4 m-4 rounded-[2.5rem] shadow-2xl z-50 border border-white/10 transition-all duration-300 overflow-hidden ${themeConfig.sidebar}`}>
          
          {/* 1. 顶部区域：折叠按钮 + Logo */}
          <div className={`pt-8 pb-6 flex flex-col ${isSidebarCollapsed ? 'items-center px-0' : 'px-8'}`}>
              
              {/* 折叠切换按钮 */}
              <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`mb-6 p-2 rounded-xl transition-colors ${isLightTheme ? 'bg-white/50 hover:bg-white text-slate-500' : 'bg-white/10 hover:bg-white/20 text-white/70'} ${!isSidebarCollapsed ? 'self-end' : ''}`}
                  title={isSidebarCollapsed ? "展开菜单" : "收起菜单"}
              >
                  {isSidebarCollapsed ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                  )}
              </button>

              <div className={`flex items-center gap-4 group cursor-pointer ${isSidebarCollapsed ? 'flex-col justify-center' : ''}`} onClick={() => handleNav('dashboard')}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-300 ${isLightTheme ? 'bg-white text-indigo-600' : 'bg-gradient-to-br from-white/20 to-white/5 text-white border border-white/10'}`}>
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  {!isSidebarCollapsed && (
                      <div className="animate-fade-in">
                          <h1 className={`text-2xl font-black tracking-tight leading-none ${logoTextColor}`}>Smart</h1>
                          <h1 className={`text-2xl font-black tracking-tight leading-none opacity-80 ${logoTextColor}`}>Ledger</h1>
                      </div>
                  )}
              </div>
              
              {/* 2. 记一笔按钮 (颜色跟随皮肤主题 Accent) */}
              <button 
                  onClick={handleAddClick} 
                  className={`mt-8 py-4 rounded-2xl font-bold shadow-xl shadow-black/10 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center group relative overflow-hidden bg-gradient-to-r ${themeConfig.accent} text-white border border-white/10 ${isSidebarCollapsed ? 'w-12 h-12 p-0' : 'w-full gap-3'}`}
                  title="记一笔"
              >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md"></div>
                  <div className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-white relative z-10">
                      <svg className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  {!isSidebarCollapsed && <span className="relative z-10 tracking-wide animate-fade-in">记一笔</span>}
              </button>
          </div>

          {/* 3. 导航菜单区域 */}
          <nav className={`flex-1 space-y-2 overflow-y-auto custom-scrollbar py-2 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
              {[
                  { id: 'dashboard', label: '总览 Dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /> },
                  { id: 'list', label: '明细 Assets', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2-2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
                  { id: 'calendar', label: '日历 Calendar', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
                  { id: 'profile', label: '设置 Settings', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
              ].map(item => {
                  const isActive = view === item.id;
                  
                  const activeClass = isLightTheme 
                      ? 'bg-slate-900 text-white shadow-lg translate-x-2' 
                      : 'bg-white text-slate-900 shadow-lg shadow-white/10 translate-x-2';
                  
                  const hoverClass = isLightTheme 
                      ? 'hover:bg-slate-200/60 hover:pl-6' 
                      : 'hover:bg-white/10 hover:pl-6';

                  const textInactive = isLightTheme ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium';

                  return (
                      <button 
                          key={item.id}
                          onClick={() => handleNav(item.id as ViewState)} 
                          className={`w-full text-left py-3.5 rounded-2xl transition-all duration-300 ease-out flex items-center group relative overflow-hidden ${isSidebarCollapsed ? 'justify-center px-0' : 'px-5 gap-4'} ${isActive ? `${activeClass} ${!isSidebarCollapsed ? 'translate-x-2' : ''}` : `${textInactive} ${hoverClass} ${!isSidebarCollapsed ? 'hover:pl-6' : ''}`}`}
                          title={isSidebarCollapsed ? item.label : ''}
                      >
                          <svg className={`w-5 h-5 transition-colors ${isActive ? 'text-current' : navIconColor} group-hover:scale-110`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                          {!isSidebarCollapsed && (
                              <>
                                <span className={`text-sm tracking-wide truncate ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                                {isActive && <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>}
                              </>
                          )}
                      </button>
                  );
              })}
          </nav>

          {/* 4. 底部用户卡片 */}
          <div className={`p-6 mt-auto ${isSidebarCollapsed ? 'px-2 flex justify-center' : ''}`}>
              <div 
                className={`relative rounded-3xl p-3 flex items-center transition-all duration-300 group cursor-pointer border ${isSidebarCollapsed ? 'justify-center bg-transparent border-transparent' : `gap-3 ${isLightTheme ? 'bg-white/60 border-slate-200 hover:bg-white hover:shadow-xl hover:-translate-y-1' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1'}`}`} 
                onClick={() => handleNav('profile')}
                title={user ? (user.preferences?.nickname || user.email) : '访客用户'}
              >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-[2px] shadow-sm shrink-0">
                      <div className="w-full h-full rounded-[14px] overflow-hidden bg-white flex items-center justify-center">
                        {user?.preferences?.avatar ? (
                            <img src={user.preferences.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs">
                                {user ? (user.preferences?.nickname?.[0] || user.email[0]).toUpperCase() : 'G'}
                            </div>
                        )}
                      </div>
                  </div>
                  
                  {!isSidebarCollapsed && (
                      <div className="flex-1 min-w-0 animate-fade-in">
                          <p className={`text-sm font-bold truncate ${profileTextMain}`}>
                              {user ? (user.preferences?.nickname || maskEmail(user.email)) : '访客用户'}
                          </p>
                          
                          <button onClick={(e) => { e.stopPropagation(); user ? handleLogout() : setView('auth'); }} className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 transition-colors ${isLightTheme ? 'text-indigo-500 group-hover:text-indigo-600' : 'text-indigo-300 group-hover:text-white'}`}>
                              {user ? '点击退出' : '登录同步'}
                              <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </div>
      );
  };

  // --- 移动端顶部导航 (已添加登录按钮) ---
  const MobileTopHeader = () => (
      <div className="md:hidden px-6 pt-10 pb-2 flex justify-between items-end bg-slate-50 sticky top-0 z-40 border-b border-slate-100">
         <div>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Smart Ledger</h1>
             <p className="text-xs text-slate-400">{user ? 'Cloud Sync Active' : 'Local Mode'}</p>
         </div>
         
         {user ? (
             // 已登录：显示头像
             <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-700 shadow-sm overflow-hidden" onClick={() => handleNav('profile')}>
                 {user?.preferences?.avatar ? (
                     <img src={user.preferences.avatar} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                     <span>{(user?.preferences?.nickname?.[0] || user.email[0]).toUpperCase()}</span>
                 )}
             </div>
         ) : (
             // 未登录：显示醒目的登录按钮
             <button 
                onClick={() => setView('auth')}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-full shadow-md active:scale-95 transition-transform"
             >
                登录 / 同步
             </button>
         )}
     </div>
  );

  // --- 移动端底部导航 ---
  const MobileBottomNav = () => (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-6 py-2 z-50 safe-area-pb flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {[
              { id: 'dashboard', label: '总览', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
              { id: 'list', label: '明细', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2-2v12a2 2 0 002 2h10a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
              { id: 'add', label: '记一笔', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />, isAction: true },
              { id: 'calendar', label: '日历', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
              { id: 'profile', label: '我的', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
          ].map(item => {
              if (item.isAction) {
                  return (
                      <button 
                          key={item.id}
                          onClick={handleAddClick}
                          className="relative -top-6 bg-slate-900 text-white p-4 rounded-full shadow-lg shadow-slate-900/30 transition transform active:scale-90 flex items-center justify-center border-4 border-slate-50"
                      >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                      </button>
                  );
              }
              const isActive = view === item.id;
              return (
                  <button 
                      key={item.id}
                      onClick={() => handleNav(item.id as ViewState)} 
                      className={`flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <svg className={`w-6 h-6 ${isActive ? 'fill-slate-100' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                      <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                  </button>
              );
          })}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden md:overflow-visible">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* --- Desktop Sidebar --- */}
      <DesktopSidebar />

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col md:overflow-y-auto md:min-h-screen relative pb-24 md:pb-0">
         
         {/* Mobile Top Header (独立组件化) */}
         <MobileTopHeader />

         <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
            {view === 'dashboard' && <Dashboard items={items} rates={rates} theme={theme} />}
            
            <div style={{ display: view === 'list' ? 'block' : 'none' }}>
                <InvestmentList 
                    items={items} 
                    onDelete={handleDelete} 
                    onEdit={handleEditClick} 
                    onReorder={handleReorder} 
                    onRefreshMarket={() => handleRefreshMarketData(false)} 
                    filter={listFilter} setFilter={setListFilter}
                    productFilter={listProductFilter} setProductFilter={setListProductFilter}
                    currencyFilter={listCurrencyFilter} setCurrencyFilter={setListCurrencyFilter}
                    categoryFilter={listCategoryFilter} setCategoryFilter={setListCategoryFilter}
                    sortType={listSortType} setSortType={setListSortType}
                    showCustomDate={listShowCustomDate} setShowCustomDate={setListShowCustomDate}
                    customStart={listCustomStart} setCustomStart={setListCustomStart}
                    customEnd={listCustomEnd} setCustomEnd={setListCustomEnd}
                />
            </div>

            {view === 'calendar' && <CalendarView items={items} />}
            {view === 'profile' && <Profile user={user} rates={rates} currentTheme={theme} onSaveRates={handleRatesChange} onSaveTheme={handleThemeChange} onSaveProfile={handleProfileUpdate} onLogout={handleLogout} onNotify={showToast} />}
         </div>

         {/* --- Mobile Bottom Nav --- */}
         <MobileBottomNav />

         {/* Modal Layer for Add/Edit Form */}
         {isFormOpen && (
             <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
                 <div className="w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                     <button 
                        onClick={() => setIsFormOpen(false)}
                        className="absolute -top-10 right-0 md:-right-10 p-2 text-white/80 hover:text-white transition"
                     >
                         <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                     <InvestmentForm 
                        onSave={handleSaveItem} 
                        onCancel={() => setIsFormOpen(false)} 
                        initialData={editingItem} 
                        onNotify={showToast} 
                     />
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default App;