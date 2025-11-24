
import React, { useState, useEffect } from 'react';
import { ExchangeRates, Investment, User, ViewState, ThemeOption } from './types';
import Dashboard from './components/Dashboard';
import InvestmentList from './components/InvestmentList';
import InvestmentForm from './components/InvestmentForm';
import CalendarView from './components/CalendarView';
import Auth from './components/Auth';
import Profile from './components/Profile';
import { storageService } from './services/storage';
import { THEMES } from './utils';

const App: React.FC = () => {
  const [items, setItems] = useState<Investment[]>([]);
  const [view, setView] = useState<ViewState>('dashboard');
  const [editingItem, setEditingItem] = useState<Investment | null>(null);
  
  // New Global States
  const [user, setUser] = useState<User | null>(null);
  const [rates, setRates] = useState<ExchangeRates>(storageService.getRates());
  const [theme, setTheme] = useState<ThemeOption>('slate');

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Initialize App (Load Data & Auth)
  useEffect(() => {
    const currentUser = storageService.getLocalUser();
    const currentTheme = storageService.getTheme();
    const localData = storageService.getLocalData();
    
    setUser(currentUser);
    setTheme(currentTheme);

    // Initial Load from Local Cache
    if (localData) {
        setItems(localData);
    } else if (!currentUser) {
        // Seed Data only if guest and empty
        const seed: Investment[] = [
            { id: '1', name: '新手专享理财', category: 'Fixed', currency: 'CNY', depositDate: '2023-10-01', maturityDate: '2023-11-01', withdrawalDate: '2023-11-02', principal: 50000, expectedRate: 3.5, realizedReturn: 145, rebate: 100, isRebateReceived: true, notes: '新人福利' },
            { id: '2', name: '稳健季季红', category: 'Deposit', currency: 'CNY', depositDate: '2024-01-15', maturityDate: '2024-04-15', withdrawalDate: null, principal: 100000, expectedRate: 3.2, rebate: 200, isRebateReceived: false, notes: '银行定期' },
        ];
        setItems(seed);
    }

    // Cloud Sync: If logged in, fetch fresh data from DB
    if (currentUser) {
        storageService.syncDown(currentUser.id).then(cloudData => {
            if (cloudData && Array.isArray(cloudData)) {
                 console.log("Cloud data synced:", cloudData.length, "items");
                 setItems(cloudData);
            }
        });
    }
  }, []);

  // 2. Save Data Logic (Hybrid: DB + Local)
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
    setView('list');
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    const updatedList = items.filter(i => i.id !== id);
    saveItems(updatedList);
  };

  const handleLogin = (loggedInUser: User) => {
      setUser(loggedInUser);
      
      // IMPORTANT: Load the fresh data that was synced to localStorage during the login process
      const freshData = storageService.getLocalData();
      if (freshData) {
          setItems(freshData);
      }

      setView('dashboard');
  };

  const handleLogout = () => {
      storageService.logout();
      setUser(null);
      setView('auth');
  };

  const handleThemeChange = (newTheme: ThemeOption) => {
      setTheme(newTheme);
      storageService.saveTheme(newTheme);
  };

  const handleRatesChange = (newRates: ExchangeRates) => {
      setRates(newRates);
      storageService.saveRates(newRates);
  };

  // Helper to close menu on nav
  const handleNav = (targetView: ViewState) => {
      setView(targetView);
      setIsMobileMenuOpen(false);
  };

  // --- View Rendering ---
  const themeConfig = THEMES[theme];

  if (view === 'auth' && !user) {
      return <Auth onLogin={handleLogin} onCancel={() => setView('dashboard')} currentItems={items} />;
  }

  const NavItems = () => (
      <>
        <button 
            onClick={() => handleNav('dashboard')} 
            className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'dashboard' ? themeConfig.navActive : themeConfig.navHover}`}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            总览 Dashboard
        </button>
        <button 
            onClick={() => handleNav('list')} 
            className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'list' ? themeConfig.navActive : themeConfig.navHover}`}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            明细 List
        </button>
        <button 
            onClick={() => handleNav('calendar')} 
            className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'calendar' ? themeConfig.navActive : themeConfig.navHover}`}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            日历 Calendar
        </button>
        <button 
            onClick={() => handleNav('profile')} 
            className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'profile' ? themeConfig.navActive : themeConfig.navHover}`}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            设置 Settings
        </button>
      </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* --- Mobile Header --- */}
      <div className={`${themeConfig.sidebar} md:hidden p-4 flex justify-between items-center sticky top-0 z-50 shadow-md`}>
        <div className="flex items-center gap-3">
             {/* Hamburger Button */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 rounded-md hover:bg-white/10">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="font-bold text-lg">Smart Ledger</h1>
        </div>
        <button 
            onClick={() => { setEditingItem(null); setView('add'); }}
            className={`bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold backdrop-blur-sm transition`}
        >
            + 记一笔
        </button>
      </div>

      {/* --- Mobile Menu Overlay --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>
            
            {/* Drawer */}
            <div className={`absolute left-0 top-0 bottom-0 w-3/4 max-w-sm ${themeConfig.sidebar} shadow-2xl animate-slide-in-left flex flex-col`}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Smart Ledger</h2>
                        <p className="text-xs opacity-60 mt-1">{user ? user.email : '访客模式'}</p>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <NavItems />
                </nav>

                <div className="p-4 border-t border-white/10">
                    {!user ? (
                        <button 
                            onClick={() => handleNav('auth')} 
                            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition flex justify-center items-center gap-2"
                        >
                            登录 / 注册
                        </button>
                    ) : (
                        <button 
                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                            className="w-full py-3 border border-white/20 text-white hover:bg-white/10 rounded-xl font-bold transition flex justify-center items-center gap-2"
                        >
                            退出登录
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- Desktop Sidebar --- */}
      <div className={`hidden md:flex flex-col w-64 ${themeConfig.sidebar} h-screen sticky top-0 transition-colors duration-300`}>
        <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tight">Smart Ledger</h1>
            <p className={`text-xs mt-1 opacity-60`}>智能理财账本 {user ? '(Cloud)' : '(Local)'}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
           <NavItems />
        </nav>

        <div className="p-4">
            <button 
                onClick={() => { setEditingItem(null); setView('add'); }}
                className={`w-full py-3 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2 ${theme === 'ivory' ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-white text-slate-900 hover:bg-slate-100'} active:scale-95`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                记一笔
            </button>
            {!user && (
                <button 
                    onClick={() => setView('auth')} 
                    className={`w-full mt-3 text-xs text-center py-2 ${theme === 'ivory' || theme === 'lavender' || theme === 'mint' || theme === 'sky' || theme === 'sakura' ? 'text-slate-500 hover:text-slate-800' : 'text-white/50 hover:text-white'}`}
                >
                    登录 / 注册同步
                </button>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:overflow-y-auto md:h-screen">
         <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20 md:pb-8">
            {view === 'dashboard' && <Dashboard items={items} rates={rates} theme={theme} />}
            {view === 'list' && <InvestmentList items={items} onDelete={handleDelete} onEdit={(item) => { setEditingItem(item); setView('add'); }} />}
            {view === 'calendar' && <CalendarView items={items} />}
            {view === 'profile' && (
                <Profile 
                    user={user} 
                    rates={rates} 
                    currentTheme={theme} 
                    onSaveRates={handleRatesChange} 
                    onSaveTheme={handleThemeChange} 
                    onLogout={handleLogout}
                />
            )}
            {view === 'add' && (
                <InvestmentForm 
                    onSave={handleSaveItem} 
                    onCancel={() => setView('list')} 
                    initialData={editingItem}
                />
            )}
         </div>
      </div>
    </div>
  );
};

export default App;
