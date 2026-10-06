import React, { useState, useMemo } from 'react';
import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption, CATEGORY_LABELS } from '../types';
import { calculateItemMetrics, calculatePortfolioStats, calculatePeriodStats, calculateTotalValuation, getTimeFilterRange, formatCurrency, formatPercent, THEMES, calculateDailyReturn, formatDate, MS_PER_DAY } from '../utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

interface Props {
  items: Investment[];
  rates: ExchangeRates;
  theme: ThemeOption;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#84cc16', '#6366f1'];

interface MetricCardProps {
    title: string;
    mainValue: number;
    subValue?: string;
    currency: Currency;
    breakdownList: { label: string; value: number; color?: string }[];
    categoryData: { name: string; value: number }[];
    infoAction?: () => void;
    themeConfig: any;
    colorTheme: 'indigo' | 'blue' | 'orange' | 'amber' | 'purple' | 'red'; // Added 'red' for risk card
    waccValue?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
    title, mainValue, subValue, currency, breakdownList, categoryData, infoAction, colorTheme, waccValue
}) => {
    const [mode, setMode] = useState<'list' | 'chart'>('list');
    const [activeIndex, setActiveIndex] = useState(0);

    const themeColors = {
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
        red: { bg: 'bg-red-50', text: 'text-red-600' }, // Added red theme
    }[colorTheme];

    const onPieEnter = (_: any, index: number) => setActiveIndex(index);

    const renderActiveShape = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
        return (
            <g>
                <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="#1e293b" className="text-sm font-bold">
                    {payload.name}
                </text>
                <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill={fill} className="text-xs font-mono">
                    {formatCurrency(value, currency)}
                </text>
                <Sector
                    cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4}
                    startAngle={startAngle} endAngle={endAngle} fill={fill}
                />
            </g>
        );
    };

    return (
        <div className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden h-[260px] flex flex-col`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-2 shrink-0 relative z-10">
                <div className={`p-2.5 ${themeColors.bg} rounded-xl ${themeColors.text} cursor-pointer hover:scale-105 transition-transform`} onClick={infoAction}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setMode('list')}
                        className={`p-1.5 rounded-md transition-all ${mode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </button>
                    <button 
                        onClick={() => setMode('chart')}
                        className={`p-1.5 rounded-md transition-all ${mode === 'chart' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col relative z-10 min-h-0">
                {mode === 'list' ? (
                    <div className="animate-fade-in flex flex-col h-full">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 opacity-80">{title}</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-bold ${themeColors.text} font-mono tracking-tight`}>
                                    {colorTheme === 'purple' ? formatPercent(mainValue) : formatCurrency(mainValue, currency)}
                                </span>
                                {subValue && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{subValue}</span>}
                            </div>
                            {/* Display WACC info only for the PURPLE/YIELD card */}
                            {colorTheme === 'purple' && waccValue !== undefined && waccValue > 0 && (
                                <p className="text-[10px] text-slate-400 mt-1">加权资金成本 (WACC): {formatCurrency(waccValue, currency)} / 365天</p>
                            )}
                        </div>
                        
                        <div className="mt-auto pt-3 border-t border-slate-50 space-y-2.5 pb-3">
                            {breakdownList.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.color || 'bg-slate-300'}`}></div>
                                        {item.label}
                                    </span>
                                    {/* Special handling for WACC row */}
                                    <span className="font-mono font-medium text-slate-600">
                                        {item.label.includes('WACC') ? `${formatCurrency(item.value, currency)}` : `${item.value > 0 ? '+' : ''}${formatCurrency(item.value, currency)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in h-full flex flex-col items-center justify-center relative pb-2">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={4}
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                        stroke="none"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-300 text-xs flex flex-col items-center gap-1">
                                <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                暂无分类数据
                            </div>
                        )}
                        <p className="absolute bottom-0 text-[10px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none">By Asset Type</p>
                    </div>
                )}
            </div>
            
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${themeColors.bg} opacity-50 blur-2xl pointer-events-none`}></div>
        </div>
    );
};


const TIME_FILTERS: { label: string, value: TimeFilter }[] = [
    { label: '全部', value: 'all' },
    { label: '今年至今', value: 'ytd' },
    { label: '近1月', value: '1m' },
    { label: '近3月', value: '3m' },
    { label: '近1年', value: '1y' },
];

// 日期字符串（YYYY-MM-DD）加 N 天
const addDays = (dateStr: string, n: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Dashboard: React.FC<Props> = ({ items, rates, theme }) => {  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [distributionMode, setDistributionMode] = useState<'status' | 'allocation'>('status');
  
  const [rebateModalType, setRebateModalType] = useState<'received' | 'pending' | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: React.ReactNode } | null>(null);

  const themeConfig = THEMES[theme];

  const globalValuation = useMemo(() => calculateTotalValuation(items, selectedCurrency, rates), [items, selectedCurrency, rates]);

  const currencyItems = useMemo(() => items.filter(i => (i.currency || 'CNY') === selectedCurrency), [items, selectedCurrency]);
  
  // Calculate main stats based on time filter
  const stats = useMemo(() => {
      // 1. 始终计算 ALL TIME stats，以获取准确的 todayEstProfit
      const allTimeStats = calculatePortfolioStats(currencyItems); 

      let periodStats = allTimeStats; 

      if (timeFilter !== 'all') {
          // 2. 如果时间筛选激活，计算 PERIOD stats 以获取 period metrics
          const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd); 
          periodStats = calculatePeriodStats(currencyItems, start, end); 
      }
      
      // 3. 修正：合并数据。对于 period metrics 使用 periodStats 的结果，但强制 todayEstProfit 使用 unfiltered 的结果。
      return {
          ...periodStats, 
          todayEstProfit: allTimeStats.todayEstProfit,
          totalCapitalWACC: periodStats.totalCapitalWACC
      };
  }, [currencyItems, timeFilter, customStart, customEnd]);

  // --- Breakdown Data Calculation ---

  // 1. Total Projected Profit Breakdown & Category Data (Corrected for Time Filter)
  const { totalBreakdownList, totalCategoryData } = useMemo(() => {
      // Helper function to check if a date string falls within the current filter period
      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);
      const isBetween = (dateStr: string) => {
          const d = new Date(dateStr);
          // Only check date part, ignore time component (start/end already set hours for comparison in getTimeFilterRange)
          return d >= start && d <= end;
      };
      
      const catMap: Record<string, number> = {};
      
      // Breakdown logic uses the current profit sum structure
      const realizedOnly = stats.realizedInterest;
      const receivedRebate = stats.receivedRebate;
      const floatingAndAccrued = stats.projectedTotalProfit - realizedOnly - receivedRebate;
      
      const list = [
          { label: '持仓浮盈/利息', value: floatingAndAccrued, color: 'bg-blue-400' },
          { label: '已结盈亏', value: realizedOnly, color: 'bg-emerald-400' },
          { label: '总返利', value: stats.totalRebate, color: 'bg-amber-400' }
      ];

      currencyItems.forEach(item => {
          let p = 0; // itemPeriodTotalProfit
          if (timeFilter === 'all') {
              // All Time Logic (Ensures consistency with calculatePortfolioStats)
              const m = calculateItemMetrics(item);
              if (!m.isCompleted && !m.isPending && item.type === 'Fixed') {
                  p = m.accruedReturn + item.rebate + item.totalRealizedProfit;
              } else if (!m.isCompleted && item.type === 'Floating') {
                  p = m.profit;
              } else {
                  p = m.profit;
              }
              
              // Fee deduction for projection (Copied from calculatePortfolioStats)
              const todayISO = new Date().toISOString().split('T')[0];
              if (!m.isCompleted && item.transactions) {
                  item.transactions.forEach(tx => {
                      const txDate = tx.date.split('T')[0];
                      if (txDate > todayISO && (tx.type === 'Fee' || tx.type === 'Tax')) {
                          p -= tx.amount;
                      }
                  });
              }

          } else {
              // PERIOD LOGIC: Mirroring calculatePeriodStats in utils.ts to ensure consistency
              const withdrawalDate = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
              const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;
              const m = calculateItemMetrics(item);
              
              // 1. Accrued / Floating
              if (item.type === 'Fixed' && !isCompletedInPeriod) {
                  p += m.accruedReturn;
              } else if (item.type === 'Floating' && !isCompletedInPeriod) {
                   p += (item.currentReturn || 0) + item.totalRealizedProfit;
              }
              
              // 2. Completion Net Profit
              if (isCompletedInPeriod) {
                  p += m.baseInterest;
              }
              
              // 3. Transactions & Rebate (if within period & received)
               if (item.transactions) {
                  item.transactions.forEach(tx => {
                      if (!isCompletedInPeriod && isBetween(tx.date)) {
                          if (tx.type === 'Dividend' || tx.type === 'Interest') p += tx.amount;
                          else if (tx.type === 'Fee' || tx.type === 'Tax') p -= tx.amount;
                      }
                  });
              }
              if (item.rebate > 0 && item.isRebateReceived && isBetween(item.depositDate)) {
                  p += item.rebate;
              }
          }
          
          if (Math.abs(p) > 0.01) {
              const name = CATEGORY_LABELS[item.category];
              // Use the actual profit value for summation, rely on Math.abs later for chart visualization
              catMap[name] = (catMap[name] || 0) + p;
          }
      });

      // Chart data is generated from the accumulated category profits (P)
      const chart = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.abs(value) }));

      return { totalBreakdownList: list, totalCategoryData: chart };
  }, [items, stats, currencyItems, timeFilter, customStart, customEnd]);

  // 2. Today Profit Breakdown (Always Today)
  const { todayBreakdownList, todayCategoryData } = useMemo(() => {
      let fixedDaily = 0;
      let floatingDaily = 0;
      const catMap: Record<string, number> = {};

      currencyItems.forEach(item => {
          const daily = calculateDailyReturn(item);
          if (item.type === 'Fixed') fixedDaily += daily;
          else floatingDaily += daily;

          if (Math.abs(daily) > 0.001) {
              const name = CATEGORY_LABELS[item.category];
              catMap[name] = (catMap[name] || 0) + daily;
          }
      });

      const list = [
          { label: '固收日息', value: fixedDaily, color: 'bg-blue-400' },
          { label: '市值波动', value: floatingDaily, color: 'bg-orange-400' }
      ];
      const chart = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.abs(value) }));

      return { todayBreakdownList: list, todayCategoryData: chart };
  }, [currencyItems]);

  // 3. Realized Profit Breakdown (Corrected for Time Filter)
  const { realizedBreakdownList, realizedCategoryData } = useMemo(() => {
      let completedNetPeriod = 0; // Net Completion Gain in Period (The '已完结项目净利' component)
      let txRealizedInPeriod = 0; // P&L Txs in Period (The '持仓中派息/减仓' component)
      let realizedItemTotalMap: Record<string, number> = {}; // Data for chart
      
      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);
      const isBetween = (dateStr: string) => {
          const d = new Date(dateStr);
          return d >= start && d <= end;
      };

      currencyItems.forEach(item => {
          let itemRealized = 0; // Total Realized P&L for this item in the period
          
          if (timeFilter === 'all') {
              const m = calculateItemMetrics(item);
              itemRealized = m.baseInterest + item.rebate + item.totalRealizedProfit;
              
              // Decompose for breakdown list
              if (m.isCompleted) completedNetPeriod += m.baseInterest;
              txRealizedInPeriod += item.totalRealizedProfit;

          } else {
              // PERIOD LOGIC: Mirroring utils.ts realizedInPeriod calculation
              const withdrawalDate = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
              const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;
              
              // 1. Completion Net Profit
              if (isCompletedInPeriod) {
                  const metrics = calculateItemMetrics(item);
                  let netCompletionGain = metrics.baseInterest; 
                  let realizedPnlTxBeforePeriod = 0;

                  if (item.transactions) {
                      item.transactions.forEach(tx => {
                          const d = new Date(tx.date);
                          if (d < start) {
                              if (tx.type === 'Dividend' || tx.type === 'Interest') realizedPnlTxBeforePeriod += tx.amount;
                              else if (tx.type === 'Fee' || tx.type === 'Tax') realizedPnlTxBeforePeriod -= tx.amount;
                          }
                      });
                  }
                  if (item.isRebateReceived && new Date(item.depositDate) < start) {
                      realizedPnlTxBeforePeriod += item.rebate;
                  }
                  
                  const completionNetProfit = netCompletionGain - realizedPnlTxBeforePeriod;
                  itemRealized += completionNetProfit;
                  completedNetPeriod += completionNetProfit;
              }

              // 2. Rebate Received in Period
              if (isBetween(item.depositDate) && item.isRebateReceived) {
                  itemRealized += item.rebate;
              }
              
              // 3. P&L Transactions (Div/Int/Fee/Tax) - only those *in* the period
              // And only if NOT completed in period (to avoid double count from Completion Net Profit)
              if (!isCompletedInPeriod && item.transactions) { 
                  item.transactions.forEach(tx => {
                      if (isBetween(tx.date)) {
                          if (tx.type === 'Dividend' || tx.type === 'Interest') {
                              itemRealized += tx.amount;
                              txRealizedInPeriod += tx.amount; // Accumulate for breakdown list
                          } else if (tx.type === 'Fee' || tx.type === 'Tax') {
                              itemRealized -= tx.amount;
                              txRealizedInPeriod -= tx.amount; // Accumulate for breakdown list
                          }
                      }
                  });
              }
          }
          
          if (Math.abs(itemRealized) > 0.01) {
              const name = CATEGORY_LABELS[item.category];
              realizedItemTotalMap[name] = (realizedItemTotalMap[name] || 0) + itemRealized;
          }
      });
      
      // Breakdown List Logic (uses the decomposed values calculated above)
      const list = [
          { 
              label: '已完结项目净利', 
              value: completedNetPeriod, 
              color: 'bg-slate-400' 
          },
          { 
              label: '持仓中派息/减仓', 
              value: txRealizedInPeriod, 
              color: 'bg-emerald-400' 
          },
          { 
              label: '已到账返利(额外)', 
              value: stats.receivedRebate, // This is already period-filtered by stats calculation
              color: 'bg-amber-400' 
          }
      ];
      
      // Final chart data
      const chart = Object.entries(realizedItemTotalMap).map(([name, value]) => ({ name, value: Math.abs(value) }));

      return { realizedBreakdownList: list, realizedCategoryData: chart };
  }, [currencyItems, stats, timeFilter, customStart, customEnd]);

  const pieDataStatus = [
    { name: '在途本金', value: stats.activePrincipal },
    { name: '已完结本金', value: stats.completedPrincipal },
  ].filter(d => d.value > 0);

  const pieDataAllocation = useMemo(() => {
      const map: Record<string, number> = {};
      currencyItems.forEach(item => {
          if (!item.withdrawalDate && item.currentPrincipal > 0) {
              const catName = CATEGORY_LABELS[item.category] || item.category;
              map[catName] = (map[catName] || 0) + item.currentPrincipal;
          }
      });
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [currencyItems]);

  const activePieData = distributionMode === 'status' ? pieDataStatus : pieDataAllocation;

  const upcoming = currencyItems
    .filter(i => {
        if (!i.maturityDate) return false;
        if (i.withdrawalDate) return false;
        if (i.currentPrincipal <= 0.01) return false; 
        return true;
    })
    .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime())
    .slice(0, 5)
    .map(i => {
        const m = calculateItemMetrics(i);
        return { ...i, daysRemaining: m.daysRemaining };
    });
    
  const handleTimeFilterClick = (filter: TimeFilter) => {
      setTimeFilter(filter);
      if (filter === 'custom') setShowCustomDate(true);
      else { setShowCustomDate(false); setCustomStart(''); setCustomEnd(''); }
  };

  // Safe Date Formatting for Rebate Modal
  const safeFormatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      // 核心修复：防止非法日期导致页面白屏
      return !isNaN(d.getTime()) ? formatDate(dateStr) : '-';
  };
  
  // =================================================================
  // FIX: Define helper functions inside the component scope (Scope Fix)
  // =================================================================

  const showTotalProfitInfo = () => setInfoModal({ title: "总预估收益 (含在途)", content: <div className="text-sm text-slate-600 space-y-2"><p>历史总回报，包含账面浮盈和已落袋资金。</p><p className="font-bold text-indigo-600">公式：浮盈 + 已结 + 返利 - 费用</p></div> });
  const showTodayProfitInfo = () => setInfoModal({ title: "今日/昨日预估收益", content: <div className="text-sm text-slate-600 space-y-2"><p>仅计算今天产生的价值变化。</p><p className="font-bold text-orange-600">公式：固收日息 + 浮动资产今日涨跌</p></div> });
  const showRealizedProfitInfo = () => setInfoModal({ title: "已落袋收益", content: <div className="text-sm text-slate-600 space-y-2"><p>真正“落袋为安”的收益。</p><p className="font-bold text-amber-600">包含：完结项目净利 + 派息 + 减仓盈利</p></div> });
  
  // Capital At Risk Info Card Action
  const showCapitalAtRiskInfo = () => setInfoModal({
      title: "待收回总资本 (Capital At Risk)",
      content: <div className="text-sm text-slate-600 space-y-2">
          <p>当前仍处于投资中，尚未结算或收回的全部资金敞口。</p>
          <p className="font-bold text-red-600">公式：在途本金 + 待到账返利</p>
      </div>
  });

  // 🚑 修复: Get items for rebate modal (Corrected with Time Filter)
  const rebateItems = useMemo(() => {
      if (!rebateModalType) return [];
      
      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);

      return currencyItems.filter(i => {
          // 1. Basic Rebate Filter
          const isRebateMatch = i.rebate > 0 && (rebateModalType === 'received' ? i.isRebateReceived : !i.isRebateReceived);
          if (!isRebateMatch) return false;

          // 2. Time Filter (FIX: Added this block)
          // If 'all', all items match (as long as they have rebate)
          if (timeFilter === 'all') return true;

          const d = new Date(i.depositDate);
          return d >= start && d <= end;
      }).sort((a, b) => b.rebate - a.rebate);
  }, [currencyItems, rebateModalType, timeFilter, customStart, customEnd]);
  // =================================================================


  return (
    <div className="space-y-6 animate-fade-in pb-12 relative">
      {/* 到期提醒：7天内到期（含已到期未取出）的持仓 */}
      {(() => {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const soon = items
              .filter(i => !i.withdrawalDate && i.maturityDate && i.maturityDate <= addDays(todayStr, 7))
              .sort((a, b) => (a.maturityDate || '').localeCompare(b.maturityDate || ''));
          if (soon.length === 0) return null;
          return (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                      <span className="text-amber-500">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      <h3 className="font-bold text-amber-800 text-sm">即将到期（{soon.length} 笔）</h3>
                  </div>
                  <div className="space-y-2">
                      {soon.slice(0, 5).map(i => {
                          const overdue = i.maturityDate! < todayStr;
                          return (
                              <div key={i.id} className="flex justify-between items-center text-sm bg-white/70 rounded-xl px-3 py-2">
                                  <span className="font-medium text-slate-700 truncate">{i.name}</span>
                                  <span className={`text-xs font-bold whitespace-nowrap ml-2 ${overdue ? 'text-red-500' : 'text-amber-600'}`}>
                                      {overdue ? `已到期 ${i.maturityDate}` : `${i.maturityDate} 到期`}
                                  </span>
                              </div>
                          );
                      })}
                      {soon.length > 5 && (
                          <p className="text-xs text-amber-600 text-center">还有 {soon.length - 5} 笔，详见日历视图</p>
                      )}
                  </div>
              </div>
          );
      })()}
      {/* Controls */}
      <div className="flex flex-col gap-4 bg-white md:bg-white/80 md:backdrop-blur-md p-4 rounded-3xl shadow-sm border border-white/50 relative md:sticky md:top-2 z-20">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3 w-full md:w-auto">
                 <span className="text-sm font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Currency</span>
                 <div className="flex gap-1 p-1.5 bg-slate-100 rounded-xl w-full md:w-auto">
                    {(['CNY', 'USD', 'HKD'] as Currency[]).map(c => (
                        <button key={c} onClick={() => setSelectedCurrency(c)} className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-all shadow-sm ${selectedCurrency === c ? 'bg-white text-slate-800 ring-1 ring-black/5' : 'bg-transparent text-slate-400 hover:text-slate-600 shadow-none'}`}>{c}</button>
                    ))}
                 </div>
             </div>
             <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
                {TIME_FILTERS.map(f => (
                    <button key={f.value} onClick={() => handleTimeFilterClick(f.value)} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${timeFilter === f.value ? themeConfig.button + ' text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>{f.label}</button>
                ))}
                <button onClick={() => handleTimeFilterClick('custom')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${timeFilter === 'custom' ? themeConfig.button + ' text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>自定义</button>
             </div>
         </div>
         {showCustomDate && (
              <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-fade-in">
                  <span className="text-xs font-bold text-slate-400 uppercase">Range:</span>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none" />
                  <span className="text-slate-300">-</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none" />
              </div>
          )}
      </div>

      {/* Global Net Worth Card */}
      <div className={`bg-gradient-to-br ${themeConfig.accent} p-6 md:p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden transform-gpu`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-center md:text-left w-full">
            <div className="flex flex-col items-center md:items-start w-full">
                <p className="text-white/70 font-medium mb-1 flex items-center gap-2 justify-center md:justify-start">
                    <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    全货币持仓估值 (Global Net Worth)
                </p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2 tabular-nums break-all">{formatCurrency(globalValuation, selectedCurrency)}</h2>
                <p className="text-xs md:text-sm text-white/60">包含所有 CNY, USD, HKD 资产及预估收益折算为 {selectedCurrency}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 w-full md:w-auto flex flex-col items-center md:items-end">
                <p className="text-xs text-white/60 uppercase tracking-wider mb-1">当前设定汇率</p>
                <div className="flex gap-4 text-sm font-mono text-white/90">
                    <span>USD ≈ {rates.USD}</span><span className="opacity-50">|</span><span>HKD ≈ {rates.HKD}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        
        {/* 1. Active Principal / Capital At Risk (New Card) */}
        <MetricCard 
            title={timeFilter === 'all' ? '待收回总资本' : '期间 WACC 本金'}
            mainValue={timeFilter === 'all' ? stats.activePrincipal + stats.pendingRebate : stats.totalInvested}
            subValue={undefined} // Removed redundant UI element
            currency={selectedCurrency}
            colorTheme={timeFilter === 'all' ? 'red' : 'blue'}
            breakdownList={timeFilter === 'all' ? [
                { label: '在途本金', value: stats.activePrincipal, color: 'bg-blue-400' },
                { label: '待返利总额', value: stats.pendingRebate, color: 'bg-amber-400' },
            ] : [
                { label: '期间投入本金', value: stats.totalInvested, color: 'bg-blue-400' },
            ]}
            categoryData={[]}
            infoAction={showCapitalAtRiskInfo}
            themeConfig={themeConfig}
        />

        {/* 2. Total Profit */}
        <MetricCard 
            title={timeFilter === 'all' ? '总预估收益 (含在途)' : '本期产生收益'}
            mainValue={stats.projectedTotalProfit}
            subValue={timeFilter === 'all' ? formatPercent(stats.projectedTotalYield) : undefined}
            currency={selectedCurrency}
            colorTheme="indigo"
            breakdownList={totalBreakdownList}
            categoryData={totalCategoryData}
            infoAction={showTotalProfitInfo}
            themeConfig={themeConfig}
        />

        {/* 3. Today Profit */}
        <MetricCard 
            title="今日/昨日预估收益"
            mainValue={stats.todayEstProfit}
            currency={selectedCurrency}
            colorTheme="orange"
            breakdownList={todayBreakdownList}
            categoryData={todayCategoryData}
            infoAction={showTodayProfitInfo}
            themeConfig={themeConfig}
        />

        {/* 4. Realized Profit */}
        <MetricCard 
            title={timeFilter === 'all' ? '已落袋收益' : '本期已落袋'}
            mainValue={stats.realizedInterest}
            currency={selectedCurrency}
            colorTheme="amber"
            breakdownList={realizedBreakdownList}
            categoryData={realizedCategoryData}
            infoAction={showRealizedProfitInfo}
            themeConfig={themeConfig}
        />

        {/* 5. Weighted Yield (MWR) */}
        <MetricCard 
            title={timeFilter === 'all' ? '综合年化收益率' : '本期年化收益率'}
            mainValue={stats.comprehensiveYield}
            currency={selectedCurrency}
            colorTheme="purple"
            breakdownList={[
                { label: '周期净收益', value: stats.projectedTotalProfit, color: 'bg-indigo-400' },
                { label: '资金占用基数 (WACC)', value: stats.totalCapitalWACC / 365, color: 'bg-purple-400' },
            ]}
            categoryData={[]} // Not useful here
            waccValue={stats.totalCapitalWACC} 
            infoAction={() => setInfoModal({ 
                title: "资金加权回报率 (MWR)", 
                content: <div className="text-sm text-slate-600 space-y-2">
                    <p>MWR是衡量特定周期内资金效率的专业指标。</p>
                    <p className="font-bold text-purple-600">公式: (周期净收益 / WACC) * 365</p>
                    <p className="text-xs text-slate-400">WACC (加权资金成本) = ∑(投入本金 × 投入天数)</p>
                </div> 
            })}
            themeConfig={themeConfig}
        />
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
                 <div onClick={() => setRebateModalType('received')} className="flex justify-between items-center group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-50 group-hover:ring-emerald-200 transition-all"></div>
                        <span className="text-slate-600 text-sm font-medium">已到账</span>
                        <svg className="w-3 h-3 text-slate-300 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <span className="font-semibold text-emerald-600 font-mono tabular-nums">{formatCurrency(stats.receivedRebate, selectedCurrency)}</span>
                 </div>
                 <div onClick={() => setRebateModalType('pending')} className="flex justify-between items-center group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-amber-50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-50 group-hover:ring-amber-200 transition-all"></div>
                        <span className="text-slate-600 text-sm font-medium">待返利</span>
                        <svg className="w-3 h-3 text-slate-300 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <span className="font-semibold text-amber-500 font-mono tabular-nums">{formatCurrency(stats.pendingRebate, selectedCurrency)}</span>
                 </div>
            </div>
         </div>
         
         {/* Asset Distribution */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">
            <div className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className={`w-1.5 h-6 rounded-full ${distributionMode === 'status' ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
                        {distributionMode === 'status' ? '资金状态分布' : '在途资产分布'}
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setDistributionMode('status')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${distributionMode === 'status' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>状态</button>
                        <button onClick={() => setDistributionMode('allocation')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${distributionMode === 'allocation' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>分布</button>
                    </div>
                </div>
                <div className="h-[250px] w-full relative">
                    {activePieData.length > 0 ? (
                        <ResponsiveContainer width="99%" height="100%">
                            <PieChart>
                                <Pie data={activePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" cornerRadius={8} stroke="none">
                                    {activePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(val: number) => formatCurrency(val, selectedCurrency)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px 16px', zIndex: 100 }} itemStyle={{ fontWeight: 600, color: '#1e293b' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="absolute inset-0 flex items-center justify-center text-slate-300">暂无数据</div>}
                </div>
            </div>
            <div className="w-full relative md:border-l md:border-slate-100 md:pl-8">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>近期到期 ({selectedCurrency})</h3>
                <div className="space-y-3 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                    {upcoming.length === 0 ? <div className="flex flex-col items-center justify-center h-40 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl"><p className="text-sm">无近期到期项目</p></div> : upcoming.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-emerald-100 transition-all group">
                            <div className="min-w-0"><p className="font-bold text-slate-700 text-sm truncate">{item.name}</p><p className="text-xs text-slate-400 mt-0.5">{item.maturityDate}</p></div>
                            <div className="text-right whitespace-nowrap pl-4"><p className="font-bold text-slate-700 text-sm font-mono tabular-nums">{formatCurrency(item.currentPrincipal, selectedCurrency)}</p><p className={`text-xs font-bold mt-0.5 ${item.daysRemaining < 0 ? 'text-red-500' : item.daysRemaining <= 7 ? 'text-orange-500' : 'text-emerald-600'}`}>{item.daysRemaining < 0 ? `逾期 ${Math.abs(item.daysRemaining)} 天` : item.daysRemaining === 0 ? '今天到期' : `${item.daysRemaining} 天后`}</p></div>
                        </div>
                    ))}
                </div>
            </div>
         </div>
      </div>

      {/* Modals */}
      {rebateModalType && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setRebateModalType(null)}>
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div><h3 className="text-lg font-bold text-slate-800">{rebateModalType === 'received' ? '已到账返利明细' : '待返利资产明细'}</h3><p className="text-xs text-slate-400 mt-0.5">Rebate Details</p></div>
                      <button onClick={() => setRebateModalType(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {rebateItems.length === 0 ? <div className="py-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2"><svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>暂无相关记录</div> : rebateItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100"><div className="min-w-0"><p className="font-bold text-slate-700 text-sm truncate">{item.name}</p><p className="text-xs text-slate-400 mt-0.5">{safeFormatDate(item.depositDate)}</p></div><div className="text-right"><p className={`font-bold font-mono text-sm ${rebateModalType === 'received' ? 'text-emerald-600' : 'text-amber-500'}`}>+{formatCurrency(item.rebate, item.currency)}</p><span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">{item.type === 'Fixed' ? '固收' : '浮动'}</span></div></div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {infoModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setInfoModal(null)}>
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up relative" onClick={e => e.stopPropagation()}>
                  <div className="p-6">
                      <div className="flex justify-between items-start mb-4"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{infoModal.title}</h3><button onClick={() => setInfoModal(null)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                      <div className="bg-white">{infoModal.content}</div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;