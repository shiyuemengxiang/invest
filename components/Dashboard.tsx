
import React, { useState, useMemo } from 'react';
import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption } from '../types';
import { calculateItemMetrics, calculatePortfolioStats, calculateTotalValuation, filterInvestmentsByTime, formatCurrency, formatPercent, THEMES } from '../utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getAIAnalysis } from '../services/geminiService';

interface Props {
  items: Investment[];
  rates: ExchangeRates;
  theme: ThemeOption;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
const TIME_FILTERS: { label: string, value: TimeFilter }[] = [
    { label: '全部', value: 'all' },
    { label: '今年至今', value: 'ytd' },
    { label: '近1月', value: '1m' },
    { label: '近3月', value: '3m' },
    { label: '近1年', value: '1y' },
];

const Dashboard: React.FC<Props> = ({ items, rates, theme }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  // Custom Date Filter State
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const themeConfig = THEMES[theme];

  // Global Valuation across all currencies using dynamic rates
  const globalValuation = useMemo(() => calculateTotalValuation(items, selectedCurrency, rates), [items, selectedCurrency, rates]);

  // Filter items specifically matching the selected currency for detailed stats
  const currencyItems = useMemo(() => items.filter(i => (i.currency || 'CNY') === selectedCurrency), [items, selectedCurrency]);
  
  // Then Filter by Time for Stats
  const statsItems = useMemo(() => filterInvestmentsByTime(currencyItems, timeFilter, customStart, customEnd), [currencyItems, timeFilter, customStart, customEnd]);
  
  const stats = calculatePortfolioStats(statsItems);

  const handleAIAnalysis = async () => {
    setLoadingAi(true);
    const result = await getAIAnalysis(currencyItems); 
    setAiInsight(result);
    setLoadingAi(false);
  };

  const pieData = [
    { name: '在途本金', value: stats.activePrincipal },
    { name: '已完结本金', value: stats.completedPrincipal },
  ].filter(d => d.value > 0);

  // Upcoming
  const upcoming = currencyItems
    .filter(i => !i.withdrawalDate && i.maturityDate)
    .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime())
    .slice(0, 5)
    .map(i => {
        const m = calculateItemMetrics(i);
        return {
            ...i,
            daysRemaining: m.daysRemaining
        };
    });
    
  const handleTimeFilterClick = (filter: TimeFilter) => {
      setTimeFilter(filter);
      if (filter === 'custom') {
          setShowCustomDate(true);
      } else {
          setShowCustomDate(false);
          setCustomStart('');
          setCustomEnd('');
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Controls */}
      <div className="flex flex-col gap-4 bg-white md:bg-white/80 md:backdrop-blur-md p-4 rounded-3xl shadow-sm border border-white/50 relative md:sticky md:top-2 z-20">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3 w-full md:w-auto">
                 <span className="text-sm font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Currency</span>
                 <div className="flex gap-1 p-1.5 bg-slate-100 rounded-xl w-full md:w-auto">
                    {(['CNY', 'USD', 'HKD'] as Currency[]).map(c => (
                        <button
                            key={c}
                            onClick={() => setSelectedCurrency(c)}
                            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-all shadow-sm ${selectedCurrency === c ? 'bg-white text-slate-800 ring-1 ring-black/5' : 'bg-transparent text-slate-400 hover:text-slate-600 shadow-none'}`}
                        >
                            {c}
                        </button>
                    ))}
                 </div>
             </div>
             <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
                {TIME_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => handleTimeFilterClick(f.value)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${timeFilter === f.value ? themeConfig.button + ' text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                        {f.label}
                    </button>
                ))}
                <button
                    onClick={() => handleTimeFilterClick('custom')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${timeFilter === 'custom' ? themeConfig.button + ' text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                    自定义
                </button>
             </div>
         </div>
         
         {/* Custom Date Inputs */}
         {showCustomDate && (
              <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-fade-in">
                  <span className="text-xs font-bold text-slate-400 uppercase">Range:</span>
                  <input 
                    type="date" 
                    value={customStart} 
                    onChange={e => setCustomStart(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none"
                  />
                  <span className="text-slate-300">-</span>
                  <input 
                    type="date" 
                    value={customEnd} 
                    onChange={e => setCustomEnd(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none"
                  />
              </div>
          )}
      </div>

      {/* Global Net Worth Card */}
      <div className={`bg-gradient-to-br ${themeConfig.accent} p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden transform-gpu`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                <p className="text-white/70 font-medium mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    全货币持仓估值 (Global Net Worth)
                </p>
                <h2 className="text-5xl font-bold tracking-tight text-white mb-2 tabular-nums">
                    {formatCurrency(globalValuation, selectedCurrency)}
                </h2>
                <p className="text-sm text-white/60">
                    包含所有 CNY, USD, HKD 资产及预估收益折算为 {selectedCurrency}
                </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                <p className="text-xs text-white/60 uppercase tracking-wider mb-1">当前设定汇率</p>
                <div className="flex gap-4 text-sm font-mono text-white/90">
                    <span>USD ≈ {rates.USD}</span>
                    <span className="opacity-50">|</span>
                    <span>HKD ≈ {rates.HKD}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Estimated Total Profit (Active + Realized) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group border-indigo-100/50">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
             <span className="text-xs font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg">All Time</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">总预估收益 (含在途)</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1 tabular-nums flex items-baseline gap-2">
              {formatCurrency(stats.projectedTotalProfit, selectedCurrency)}
              <span className="text-sm font-medium text-indigo-400 bg-indigo-50 px-1.5 rounded-md" title="Total Projected Yield">
                 {formatPercent(stats.projectedTotalYield)}
              </span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">含已完结、浮动及固收(截止今日)</p>
        </div>

        {/* Today's Estimated Profit (Daily Return) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
             <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">Today/Est</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">今日/昨日预估收益</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${stats.todayEstProfit >= 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
              {stats.todayEstProfit > 0 ? '+' : ''}{formatCurrency(stats.todayEstProfit, selectedCurrency)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">含基金/股票今日估值及固收日息</p>
        </div>

        {/* Realized Profit */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
             <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{selectedCurrency} Only</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">已落袋收益</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{formatCurrency(stats.realizedInterest, selectedCurrency)}</p>
        </div>

        {/* Weighted Yield */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
             <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">Weighted</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">综合年化收益率</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{formatPercent(stats.comprehensiveYield)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Rebate Stats */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-400 rounded-full"></span>
                返利统计 (Rebates)
            </h3>
            <div className="space-y-6">
                 <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-sm font-medium">总返利金额</span>
                    <span className="font-bold text-xl text-slate-800 font-mono tabular-nums">{formatCurrency(stats.totalRebate, selectedCurrency)}</span>
                 </div>
                 <div className="h-px bg-slate-100 w-full"></div>
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-50"></div>
                        <span className="text-slate-600 text-sm">已到账</span>
                    </div>
                    <span className="font-semibold text-emerald-600 font-mono tabular-nums">{formatCurrency(stats.receivedRebate, selectedCurrency)}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-50"></div>
                        <span className="text-slate-600 text-sm">待返利</span>
                    </div>
                    <span className="font-semibold text-amber-500 font-mono tabular-nums">{formatCurrency(stats.pendingRebate, selectedCurrency)}</span>
                 </div>
            </div>
         </div>
         
         {/* Asset Distribution & Upcoming - Use Grid for stability instead of Flex */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">
            <div className="w-full">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                    资金状态分布
                </h3>
                {/* Fixed height container. Using width=99% in Recharts prevents rounding error loops */}
                <div className="h-[250px] w-full relative overflow-hidden" style={{ transform: 'translate3d(0,0,0)' }}>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="99%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={8}
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(val: number) => formatCurrency(val, selectedCurrency)} 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px 16px', zIndex: 100 }}
                                    itemStyle={{ fontWeight: 600, color: '#1e293b' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">暂无数据</div>
                    )}
                </div>
            </div>
            
            <div className="w-full relative md:border-l md:border-slate-100 md:pl-8">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                    近期到期 ({selectedCurrency})
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                    {upcoming.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                            <p className="text-sm">无近期到期项目</p>
                        </div>
                    ) : (
                        upcoming.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-emerald-100 transition-all group">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-700 text-sm truncate">{item.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{item.maturityDate}</p>
                                </div>
                                <div className="text-right whitespace-nowrap pl-4">
                                     <p className="font-bold text-slate-700 text-sm font-mono tabular-nums">{formatCurrency(item.principal, selectedCurrency)}</p>
                                     <p className={`text-xs font-bold mt-0.5 ${item.daysRemaining < 0 ? 'text-red-500' : item.daysRemaining <= 7 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                        {item.daysRemaining < 0 ? `逾期 ${Math.abs(item.daysRemaining)} 天` : 
                                         item.daysRemaining === 0 ? '今天到期' : 
                                         `${item.daysRemaining} 天后`}
                                     </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* AI Advisor Section */}
      <div className={`relative group rounded-3xl p-[1px] bg-gradient-to-r ${themeConfig.accent} shadow-xl opacity-90 hover:opacity-100 transition`}>
        <div className="bg-white rounded-[23px] p-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10 gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 bg-gradient-to-br ${themeConfig.accent} rounded-xl text-white shadow-lg`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">AI 智能理财顾问</h3>
                        <p className="text-sm text-slate-500">基于 Gemini 的个性化资产分析</p>
                    </div>
                </div>
                <button 
                    onClick={handleAIAnalysis}
                    disabled={loadingAi}
                    className={`px-6 py-3 ${themeConfig.button} text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-70 flex items-center gap-2 active:scale-95`}
                >
                    {loadingAi ? '分析中...' : '生成分析报告'}
                </button>
            </div>
            
            {aiInsight && (
                <div className="prose prose-sm prose-slate max-w-none bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-fade-in">
                    <div dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-800">$1</strong>') }} />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
