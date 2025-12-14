import React, { useState, useMemo } from 'react';
import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption, CATEGORY_LABELS } from '../types';
import { calculateItemMetrics, calculatePortfolioStats, calculatePeriodStats, calculateTotalValuation, getTimeFilterRange, formatCurrency, formatPercent, THEMES, calculateDailyReturn, formatDate, MS_PER_DAY } from '../utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { getAIAnalysis } from '../services/geminiService';

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
    colorTheme: 'indigo' | 'blue' | 'orange' | 'amber' | 'purple' | 'red'; 
    waccValue?: number;
}

// ✨ 简易 Markdown 渲染组件
const SimpleMarkdown = ({ text }: { text: string }) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="space-y-2 text-sm leading-relaxed text-indigo-50/90">
            {lines.map((line, index) => {
                if (line.startsWith('### ')) return <h4 key={index} className="text-base font-bold text-white mt-4 mb-1">{line.replace('### ', '')}</h4>;
                if (line.trim().startsWith('- ')) return (
                    <div key={index} className="flex gap-2 pl-1">
                        <span className="text-indigo-300">•</span>
                        <span dangerouslySetInnerHTML={{ __html: parseBold(line.replace('- ', '')) }}></span>
                    </div>
                );
                if (!line.trim()) return <div key={index} className="h-1"></div>;
                return <p key={index} dangerouslySetInnerHTML={{ __html: parseBold(line) }}></p>;
            })}
        </div>
    );
};

const parseBold = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<b class="text-white font-bold">$1</b>');
};

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
        red: { bg: 'bg-red-50', text: 'text-red-600' }, 
    }[colorTheme];

    const onPieEnter = (_: any, index: number) => setActiveIndex(index);

    const renderActiveShape = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
        return (
            <g>
                <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="#1e293b" className="text-sm font-bold">{payload.name}</text>
                <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill={fill} className="text-xs font-mono">{formatCurrency(value, currency)}</text>
                <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
            </g>
        );
    };

    return (
        <div className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden h-[260px] flex flex-col`}>
            <div className="flex justify-between items-start mb-2 shrink-0 relative z-10">
                <div className={`p-2.5 ${themeColors.bg} rounded-xl ${themeColors.text} cursor-pointer hover:scale-105 transition-transform`} onClick={infoAction}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setMode('list')} className={`p-1.5 rounded-md transition-all ${mode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></button>
                    <button onClick={() => setMode('chart')} className={`p-1.5 rounded-md transition-all ${mode === 'chart' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg></button>
                </div>
            </div>

            <div className="flex-1 flex flex-col relative z-10 min-h-0">
                {mode === 'list' ? (
                    <div className="animate-fade-in flex flex-col h-full">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 opacity-80">{title}</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-bold ${themeColors.text} font-mono tracking-tight`}>{colorTheme === 'purple' ? formatPercent(mainValue) : formatCurrency(mainValue, currency)}</span>
                                {subValue && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{subValue}</span>}
                            </div>
                            {colorTheme === 'purple' && waccValue !== undefined && waccValue > 0 && (
                                <p className="text-[10px] text-slate-400 mt-1">加权资金成本 (WACC): {formatCurrency(waccValue, currency)} / 365天</p>
                            )}
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-50 space-y-2.5 pb-3">
                            {breakdownList.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${item.color || 'bg-slate-300'}`}></div>{item.label}</span>
                                    <span className="font-mono font-medium text-slate-600">{item.label.includes('WACC') ? `${formatCurrency(item.value, currency)}` : `${item.value > 0 ? '+' : ''}${formatCurrency(item.value, currency)}`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in h-full flex flex-col items-center justify-center relative pb-2">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie activeIndex={activeIndex} activeShape={renderActiveShape} data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value" onMouseEnter={onPieEnter} stroke="none">
                                        {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-300 text-xs flex flex-col items-center gap-1"><svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>暂无分类数据</div>
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

const Dashboard: React.FC<Props> = ({ items, rates, theme }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [distributionMode, setDistributionMode] = useState<'status' | 'allocation'>('status');
  
  const [rebateModalType, setRebateModalType] = useState<'received' | 'pending' | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const themeConfig = THEMES[theme];

  const globalValuation = useMemo(() => calculateTotalValuation(items, selectedCurrency, rates), [items, selectedCurrency, rates]);

  const currencyItems = useMemo(() => items.filter(i => (i.currency || 'CNY') === selectedCurrency), [items, selectedCurrency]);
  
  const stats = useMemo(() => {
      const allTimeStats = calculatePortfolioStats(currencyItems); 
      let periodStats = allTimeStats; 
      if (timeFilter !== 'all') {
          const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd); 
          periodStats = calculatePeriodStats(currencyItems, start, end); 
      }
      return {
          ...periodStats, 
          todayEstProfit: allTimeStats.todayEstProfit,
          totalCapitalWACC: periodStats.totalCapitalWACC
      };
  }, [currencyItems, timeFilter, customStart, customEnd]);

  // 1. Total Projected Profit Breakdown & Category Data
  // 核心逻辑：确保分解后的三项之和严格等于 Card 2 的 Total Projected Profit
  const { totalBreakdownList, totalCategoryData } = useMemo(() => {
      const categoryDisplayConfig = {
          enableSubdivision: false,
          typeShortName: { floatingAndAccrued: '浮盈', realizedOnly: '已结', totalRebate: '已返' }
      };

      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);
      const isBetween = (dateStr: string) => {
          const d = new Date(dateStr);
          return d >= start && d <= end;
      };
      
      const catMap: Record<string, number> = {};

      const receivedRebate = stats.receivedRebate;
      // 🔥 核心修正：直接使用 stats.realizedInterest (不含返利)
      const realizedOnly = stats.realizedInterest; 
      // 🔥 浮盈/利息 = 总预估 - 已结 - 已到账返利 (确保公式闭环)
      const floatingAndAccrued = stats.projectedTotalProfit - realizedOnly - receivedRebate;
      // 🔥 Card 2 显示的是总返利 (含未收)，这只是一个参考项，不参与上述公式的平账
      // 但实际上 Card 2 的 Breakdown 里通常列出的是 "总返利" 或 "已收返利" 视业务而定
      // 为了和 "总预估收益 (含在途)" 这个概念匹配，这里展示 Total Rebate 是合理的，但需要注意它包含 Pending
      // 严谨起见，如果 projectedTotalProfit 里只加了 receivedRebate，那 Breakdown 里最好也只加 receivedRebate
      // 但为了信息量，通常显示 Total Rebate。
      const totalRebate = stats.totalRebate;

      const list = [
          { label: '持仓浮盈/利息', value: floatingAndAccrued, color: 'bg-blue-400' },
          { label: '已结盈亏', value: realizedOnly, color: 'bg-emerald-400' },
          { label: '总返利', value: totalRebate, color: 'bg-amber-400' }
      ];

      currencyItems.forEach(item => {
          const m = calculateItemMetrics(item);
          let itemFloatingAndAccrued = 0; 
          let itemRealizedOnly = 0;      
          let itemRebate = 0;            

          if (timeFilter === 'all') {
              // 全时段
              if (!m.isCompleted && !m.isPending) {
                  // 未完结项目：浮盈/利息 (修复：如果已清仓, m.baseInterest 为0)
                  itemFloatingAndAccrued = (item.type === 'Floating' && (!item.currentQuantity || item.currentQuantity <= 0)) 
                        ? 0 
                        : (item.type === 'Fixed' ? m.accruedReturn : (item.currentReturn || 0));
                  
                  itemRebate = item.rebate;
              } else if (m.isCompleted) {
                  // 已完结项目：已结净利
                  itemRealizedOnly = m.baseInterest;
                  itemRebate = item.rebate;
              } else {
                  // 纯交易产生的已结 (如清仓未归档)
                  itemRealizedOnly = item.totalRealizedProfit;
                  // 注意：如果已清仓未归档，itemFloatingAndAccrued 已经被强制为 0
              }
          } else {
              // 时段逻辑 (简化版，仅用于分类图表)
              const withdrawalDate = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
              const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;

              if (!isCompletedInPeriod) {
                   // 未完结：浮盈 (同样校验清仓状态)
                   itemFloatingAndAccrued = (item.type === 'Floating' && (!item.currentQuantity || item.currentQuantity <= 0))
                        ? 0
                        : (item.type === 'Fixed' ? m.accruedReturn : (item.currentReturn || 0));
              }
              if (isCompletedInPeriod) {
                  itemRealizedOnly = m.baseInterest;
              }
              // 补充：时段内的交易盈亏 (Partials)
              if (!isCompletedInPeriod && item.transactions) {
                  item.transactions.forEach(tx => {
                      if (isBetween(tx.date) && (tx.type === 'Dividend' || tx.type === 'Interest' || tx.type === 'Fee' || tx.type === 'Tax')) {
                          // 将交易盈亏归入 "已结" 类别
                          if (tx.type === 'Fee' || tx.type === 'Tax') itemRealizedOnly -= tx.amount;
                          else itemRealizedOnly += tx.amount;
                      }
                  });
              }

              if (isBetween(item.depositDate)) {
                  itemRebate = item.rebate;
              }
          }

          const catName = CATEGORY_LABELS[item.category] || item.category;
          const totalItemProfit = itemFloatingAndAccrued + itemRealizedOnly + itemRebate;
          if (Math.abs(totalItemProfit) > 0.01) {
              catMap[catName] = (catMap[catName] || 0) + totalItemProfit;
          }
      });

      const chart = Object.entries(catMap).filter(([_, value]) => Math.abs(value) > 0.01).map(([name, value]) => ({ name, value }));
      return { totalBreakdownList: list, totalCategoryData: chart };
  }, [items, stats, currencyItems, timeFilter, customStart, customEnd]);

  // 2. Today Profit Breakdown
  const { todayBreakdownList, todayCategoryData } = useMemo(() => {
      let fixedDaily = 0;
      let floatingDaily = 0;
      const catMap: Record<string, number> = {};

      currencyItems.forEach(item => {
          const daily = calculateDailyReturn(item);
          if (item.type === 'Fixed') fixedDaily += daily;
          else floatingDaily += daily;

          if (Math.abs(daily) > 0.001) {
              const name = CATEGORY_LABELS[item.category] || item.category;
              catMap[name] = (catMap[name] || 0) + daily;
          }
      });

      const list = [
          { label: '固收日息', value: fixedDaily, color: 'bg-blue-400' },
          { label: '市值波动', value: floatingDaily, color: 'bg-orange-400' }
      ];
      const chart = Object.entries(catMap).filter(([_, value]) => Math.abs(value) > 0.001).map(([name, value]) => ({ name, value }));
      return { todayBreakdownList: list, todayCategoryData: chart };
  }, [currencyItems]);

  // 3. Realized Profit Breakdown
  const { realizedBreakdownList, realizedCategoryData, totalRealized } = useMemo(() => {
      let completedNetPeriod = 0; 
      let txRealizedInPeriod = 0; 
      let receivedRebatePeriod = 0; 
      const realizedItemTotalMap: Record<string, number> = {};

      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);
      const isBetween = (dateStr: string) => {
          const d = new Date(dateStr);
          return d >= start && d <= end;
      };

      currencyItems.forEach(item => {
          const m = calculateItemMetrics(item);
          let itemCompletedNet = 0; 
          let itemTxRealized = 0;   
          let itemRebateReceived = 0; 

          if (timeFilter === 'all') {
              if (m.isCompleted) {
                  itemCompletedNet = m.baseInterest;
              } else {
                  // 未完结项目的交易盈亏
                  itemTxRealized = item.totalRealizedProfit;
              }
              itemRebateReceived = item.isRebateReceived ? item.rebate : 0; 
              receivedRebatePeriod = stats.receivedRebate; 
          } else {
              const withdrawalDate = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
              const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;

              if (isCompletedInPeriod) {
                  let netCompletionGain = m.baseInterest;
                  let realizedPnlTxBeforePeriod = 0;
                  item.transactions?.forEach(tx => {
                      const d = new Date(tx.date);
                      if (d < start) {
                          if (['Dividend', 'Interest'].includes(tx.type)) realizedPnlTxBeforePeriod += Number(tx.amount) || 0;
                          else if (['Fee', 'Tax'].includes(tx.type)) realizedPnlTxBeforePeriod -= Number(tx.amount) || 0;
                      }
                  });
                  itemCompletedNet = netCompletionGain - realizedPnlTxBeforePeriod;
              }

              // 仅统计未在期间内完结的项目的交易流水，防止重复
              if (!isCompletedInPeriod && item.transactions) {
                  item.transactions.forEach(tx => {
                      if (isBetween(tx.date)) {
                          if (['Dividend', 'Interest'].includes(tx.type)) itemTxRealized += Number(tx.amount) || 0;
                          else if (['Fee', 'Tax'].includes(tx.type)) itemTxRealized -= Number(tx.amount) || 0;
                      }
                  });
              }

              if (isBetween(item.depositDate) && item.isRebateReceived) {
                  itemRebateReceived = item.rebate;
                  receivedRebatePeriod += itemRebateReceived; 
              }
          }

          completedNetPeriod += itemCompletedNet;
          txRealizedInPeriod += itemTxRealized;

          const catName = CATEGORY_LABELS[item.category] || item.category;
          const totalItemRealized = itemCompletedNet + itemTxRealized + itemRebateReceived;
          if (Math.abs(totalItemRealized) > 0.01) {
                realizedItemTotalMap[catName] = (realizedItemTotalMap[catName] || 0) + totalItemRealized;
          }
      });

      const finalTotalRealized = completedNetPeriod + txRealizedInPeriod + receivedRebatePeriod;

      const list = [
          { label: '已完结项目净利', value: completedNetPeriod, color: 'bg-slate-400' },
          { label: '持仓中派息/减仓', value: txRealizedInPeriod, color: 'bg-emerald-400' },
          { label: '已到账返利(额外)', value: receivedRebatePeriod, color: 'bg-amber-400' }
      ];

      const chart = Object.entries(realizedItemTotalMap).filter(([_, value]) => Math.abs(value) > 0.01).map(([name, value]) => ({ name, value }));

      return {
          realizedBreakdownList: list,
          realizedCategoryData: chart,
          totalRealized: finalTotalRealized 
      };
  }, [currencyItems, stats, timeFilter, customStart, customEnd]);

  // ... (handleAIAnalysis 和 后续 UI 代码保持不变)
  
  const handleAIAnalysis = async () => {
    setLoadingAi(true);
    const result = await getAIAnalysis(currencyItems); 
    setAiInsight(result);
    setLoadingAi(false);
  };

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
        
        const today = new Date();
        const matDate = new Date(i.maturityDate);
        const diffTime = matDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // 修正：显示已到期（负数）和未来30天内的
        return diffDays <= 30;
    })
    .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime())
    .slice(0, 50)
    .map(i => {
        const m = calculateItemMetrics(i);
        return { ...i, daysRemaining: m.daysRemaining };
    });
    
  const handleTimeFilterClick = (filter: TimeFilter) => {
      setTimeFilter(filter);
      if (filter === 'custom') setShowCustomDate(true);
      else { setShowCustomDate(false); setCustomStart(''); setCustomEnd(''); }
  };

  const safeFormatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) ? formatDate(dateStr) : '-';
  };
  
  const showTotalProfitInfo = () => setInfoModal({ title: "总预估收益 (含在途)", content: <div className="text-sm text-slate-600 space-y-2"><p>历史总回报，包含账面浮盈和已落袋资金。</p><p className="font-bold text-indigo-600">公式：浮盈 + 已结 + 返利 - 费用</p></div> });
  const showTodayProfitInfo = () => setInfoModal({ title: "今日/昨日预估收益", content: <div className="text-sm text-slate-600 space-y-2"><p>仅计算今天产生的价值变化。</p><p className="font-bold text-orange-600">公式：固收日息 + 浮动资产今日涨跌</p></div> });
  const showRealizedProfitInfo = () => setInfoModal({ title: "已落袋收益", content: <div className="text-sm text-slate-600 space-y-2"><p>真正“落袋为安”的收益。</p><p className="font-bold text-amber-600">包含：完结项目净利 + 派息 + 减仓盈利</p></div> });
  const showCapitalAtRiskInfo = () => setInfoModal({ title: "待收回总资本 (Capital At Risk)", content: <div className="text-sm text-slate-600 space-y-2"><p>当前仍处于投资中，尚未结算或收回的全部资金敞口。</p><p className="font-bold text-red-600">公式：在途本金 + 待到账返利</p></div> });

  const rebateItems = useMemo(() => {
      if (!rebateModalType) return [];
      const { start, end } = getTimeFilterRange(timeFilter, customStart, customEnd);
      return currencyItems.filter(i => {
          const isRebateMatch = i.rebate > 0 && (rebateModalType === 'received' ? i.isRebateReceived : !i.isRebateReceived);
          if (!isRebateMatch) return false;
          if (timeFilter === 'all') return true;
          const d = new Date(i.depositDate);
          return d >= start && d <= end;
      }).sort((a, b) => b.rebate - a.rebate);
  }, [currencyItems, rebateModalType, timeFilter, customStart, customEnd]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 relative">
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <MetricCard 
            title={timeFilter === 'all' ? '待收回总资本' : '期间 WACC 本金'}
            mainValue={timeFilter === 'all' ? stats.activePrincipal + stats.pendingRebate : stats.totalInvested}
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

        <MetricCard 
            title={timeFilter === 'all' ? '已落袋收益' : '本期已落袋'}
            mainValue={totalRealized}
            currency={selectedCurrency}
            colorTheme="amber"
            breakdownList={realizedBreakdownList}
            categoryData={realizedCategoryData}
            infoAction={showRealizedProfitInfo}
            themeConfig={themeConfig}
        />

        <MetricCard 
            title={timeFilter === 'all' ? '综合年化收益率' : '本期年化收益率'}
            mainValue={stats.comprehensiveYield}
            currency={selectedCurrency}
            colorTheme="purple"
            breakdownList={[
                { label: '周期净收益', value: stats.projectedTotalProfit, color: 'bg-indigo-400' },
                { label: '资金占用基数 (WACC)', value: stats.totalCapitalWACC / 365, color: 'bg-purple-400' },
            ]}
            categoryData={[]}
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

      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-1 shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="bg-white/10 backdrop-blur-xl rounded-[1.8rem] p-6 h-full relative z-10 border border-white/10">
              <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl text-white">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white tracking-wide">AI 投资顾问</h3>
                          <p className="text-xs text-indigo-200">基于 Gemini 2.5 Flash</p>
                      </div>
                  </div>
                  <button onClick={handleAIAnalysis} disabled={loadingAi} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${loadingAi ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg transform hover:scale-105 active:scale-95'}`}>
                      {loadingAi ? '深度分析中...' : '生成诊断报告'}
                      {!loadingAi && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                  </button>
              </div>
              {aiInsight ? (
                  <div className="bg-black/20 rounded-2xl p-5 animate-fade-in border border-white/5 shadow-inner">
                      <SimpleMarkdown text={aiInsight} />
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                      <svg className="w-12 h-12 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      <p className="text-sm text-indigo-100 font-medium">点击按钮，让 AI 为您的投资组合体检</p>
                      <p className="text-xs text-white/40 mt-1">分析流动性、风险敞口及收益优化建议</p>
                  </div>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                            <div className="text-right whitespace-nowrap pl-4"><p className="font-bold text-slate-700 text-sm font-mono tabular-nums">{formatCurrency(item.currentPrincipal, selectedCurrency)}</p><p className={`text-xs font-bold mt-0.5 ${item.daysRemaining < 0 ? 'text-red-500' : item.daysRemaining <= 7 ? 'text-orange-500' : 'text-emerald-600'}`}>{item.daysRemaining < 0 ? `已到期 ${Math.abs(item.daysRemaining)} 天` : item.daysRemaining === 0 ? '今天到期' : `${item.daysRemaining} 天后`}</p></div>
                        </div>
                    ))}
                </div>
            </div>
         </div>
      </div>

      {rebateModalType && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setRebateModalType(null)}>
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div><h3 className="text-lg font-bold text-slate-800">{rebateModalType === 'received' ? '已到账返利明细' : '待返利资产明细'}</h3><p className="text-xs text-slate-400 mt-0.5">Rebate Details</p></div>
                      <button onClick={() => setRebateModalType(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
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