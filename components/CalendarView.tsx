import React, { useState, useMemo } from 'react';
import { Investment, Currency, ExchangeRates } from '../types';
import { calculateItemMetrics, formatCurrency, formatPercent, convertCurrency } from '../utils';
import { storageService } from '../services/storage';

interface Props {
  items: Investment[];
}

type ViewMode = 'name' | 'profit' | 'yield';

interface CalendarEvent {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'deposit' | 'payout' | 'expense' | 'settlement' | 'rebate';
    name: string;
    amount: number; // 严格表示 P&L (Profit, Loss, Expense, Rebate)
    principalAmount: number; // 表示本金关联量 (Deposit/Settlement)
    currency: Currency;
    yield?: number; 
    item: Investment;
    isReceived?: boolean; // 用于返利状态
}

const CalendarView: React.FC<Props> = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('name');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  const rates = storageService.getRates(); 

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const allEvents = useMemo(() => {
      const events: CalendarEvent[] = [];

      items.forEach(item => {
          const metrics = calculateItemMetrics(item);

          // A. Deposit Event (存入本金)
          if (item.depositDate) {
              const depositAmount = item.totalCost; // 使用总成本作为存入本金
              if (depositAmount > 0) {
                  events.push({
                      id: `${item.id}-dep`,
                      date: item.depositDate,
                      type: 'deposit',
                      name: item.name,
                      amount: 0, // 存入 P&L 为 0
                      principalAmount: depositAmount, // 存入本金
                      currency: item.currency,
                      item
                  });
              }
          }

          // B. Rebate Event (返利)
          const rebateDate = item.withdrawalDate || item.maturityDate;
          if (item.rebate > 0 && rebateDate) {
              events.push({
                  id: `${item.id}-rebate`,
                  date: rebateDate, 
                  type: 'rebate',
                  name: item.name,
                  amount: item.rebate, // 返利是 P&L
                  principalAmount: 0, // 无本金关联
                  currency: item.currency,
                  isReceived: item.isRebateReceived,
                  item
              });
          }

          // C. Transaction Events (交易流水 - Payout/Expense)
          let totalNetPayouts = 0; 
          
          if (item.transactions && item.transactions.length > 0) {
              item.transactions.forEach(tx => {
                  const dateStr = tx.date.split('T')[0];
                  
                  if (tx.type === 'Dividend' || tx.type === 'Interest') {
                      totalNetPayouts += tx.amount;
                      events.push({
                          id: `${item.id}-tx-${tx.id}`,
                          date: dateStr,
                          type: 'payout',
                          name: item.name,
                          amount: tx.amount, // 派息是 P&L
                          principalAmount: 0,
                          currency: item.currency,
                          yield: metrics.comprehensiveYield,
                          item
                      });
                  }
                  else if (tx.type === 'Fee' || tx.type === 'Tax') {
                      totalNetPayouts -= tx.amount;
                      events.push({
                          id: `${item.id}-tx-${tx.id}`,
                          date: dateStr,
                          type: 'expense',
                          name: item.name,
                          amount: tx.amount, // 费用是 P&L
                          principalAmount: 0,
                          currency: item.currency,
                          item
                      });
                  }
              });
          }

          // D. Settlement Event (结清/到期)
          const endDate = item.withdrawalDate || item.maturityDate;
          // 修正：只要有到期日/结算日，并且历史有投入本金，就触发结算事件 (满足 0 收益也要显示)
          const isFullySettled = endDate && item.totalCost > 0;

          if (isFullySettled) {
              // 核心修正：剩余收益 = 总收益 - 中途派息 - 返利(因为返利已单独作为事件 B 显示) 日历视图到期不能倒扣返利
              const residualProfit = metrics.profit - totalNetPayouts;
              
              events.push({
                  id: `${item.id}-end`,
                  date: endDate,
                  type: 'settlement',
                  name: item.name,
                  amount: residualProfit, // P&L
                  principalAmount: item.totalCost, // 结算返回的本金
                  currency: item.currency,
                  yield: metrics.comprehensiveYield,
                  item
              });
          }
      });

      return events;
  }, [items]);

  const monthlyStats = useMemo(() => {
      let depositTotal = 0;
      let profitTotal = 0; 
      
      const currencyBreakdown = {
          CNY: { deposit: 0, profit: 0 },
          USD: { deposit: 0, profit: 0 },
          HKD: { deposit: 0, profit: 0 }
      };

      allEvents.forEach(ev => {
          const evDate = new Date(ev.date);
          if (evDate.getFullYear() === year && evDate.getMonth() === month) {
              if (ev.type === 'deposit') {
                  depositTotal += convertCurrency(ev.principalAmount, ev.currency, selectedCurrency, rates); // 修正：使用 principalAmount
                  if (currencyBreakdown[ev.currency]) {
                      currencyBreakdown[ev.currency].deposit += ev.principalAmount;
                  }
              } else if (ev.type === 'payout' || ev.type === 'settlement' || ev.type === 'rebate') {
                  // 返利、结算 P&L、派息都计入本月收益
                  profitTotal += convertCurrency(ev.amount, ev.currency, selectedCurrency, rates);
                  if (currencyBreakdown[ev.currency]) {
                      currencyBreakdown[ev.currency].profit += ev.amount;
                  }
              } else if (ev.type === 'expense') {
                  profitTotal -= convertCurrency(ev.amount, ev.currency, selectedCurrency, rates);
                  if (currencyBreakdown[ev.currency]) {
                      currencyBreakdown[ev.currency].profit -= ev.amount;
                  }
              }
          }
      });

      return { depositTotal, profitTotal, currencyBreakdown };
  }, [allEvents, year, month, selectedCurrency, rates]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allEvents.filter(ev => ev.date === dateStr);
  };
  
  const getEventsForSelectedDate = () => {
      if (!selectedDate) return [];
      return allEvents.filter(ev => ev.date === selectedDate);
  };

  const renderEventLabel = (ev: CalendarEvent) => {
    if (ev.type === 'deposit') return `存入: ${ev.name}`;

    if (viewMode === 'profit') {
        if (ev.type === 'expense') return `支: -${formatCurrency(ev.amount, ev.currency)}`;
        if (ev.type === 'rebate') return `返: +${formatCurrency(ev.amount, ev.currency)}`;
        const prefix = ev.type === 'payout' ? '收' : '结';
        return `${prefix}: ${formatCurrency(ev.amount, ev.currency)}`;
    }
    if (viewMode === 'yield') {
        if (ev.type === 'rebate') return ev.isReceived ? '返利(已到)' : '返利(待收)';
        return ev.type === 'expense' ? '费率' : `年化: ${formatPercent(ev.yield || 0)}`;
    }
    
    if (ev.type === 'rebate') return `返利: ${ev.name}`;
    if (ev.type === 'payout') return `派息: ${ev.name}`;
    if (ev.type === 'expense') return `费用: ${ev.name}`;
    return `到期: ${ev.name}`;
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 bg-slate-50/30 border border-slate-100"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const events = getEventsForDay(d);
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
      
      days.push(
        <div 
            key={d} 
            onClick={() => setSelectedDate(dateStr)}
            className={`h-28 p-1.5 border border-slate-100 bg-white relative group transition hover:shadow-md hover:z-10 cursor-pointer ${isToday ? 'bg-indigo-50/40 ring-1 ring-indigo-200' : ''}`}
        >
          <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
              {d}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[calc(100%-28px)] no-scrollbar">
            {events.map(ev => {
                let badgeClass = '';
                // 样式逻辑
                if (ev.type === 'deposit') badgeClass = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                else if (ev.type === 'payout') badgeClass = 'bg-blue-50 border-blue-100 text-blue-700'; 
                else if (ev.type === 'expense') badgeClass = 'bg-red-50 border-red-100 text-red-700'; 
                else if (ev.type === 'rebate') {
                    // 返利：已到账(实心 amber)，未到账(空心 dashed amber)
                    badgeClass = ev.isReceived 
                        ? 'bg-amber-100 border-amber-200 text-amber-800' 
                        : 'bg-amber-50 border-amber-200 text-amber-600 border-dashed';
                }
                else badgeClass = 'bg-orange-50 border-orange-100 text-orange-700';

                return (
                    <div 
                        key={ev.id} 
                        className={`text-[10px] px-1.5 py-0.5 rounded shadow-sm border truncate font-medium ${badgeClass}`}
                        title={`${ev.name} | ${ev.type === 'expense' ? '-' : ''}${formatCurrency(ev.amount, ev.currency)}`}
                    >
                        {renderEventLabel(ev)}
                    </div>
                );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
        {/* Monthly Summary */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                 <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {year}年 {month + 1}月 财务概览
                    </h3>
                    <p className="text-xs text-slate-400">Monthly Financial Summary</p>
                 </div>
                 
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['CNY', 'USD', 'HKD'] as Currency[]).map(c => (
                        <button
                            key={c}
                            onClick={() => setSelectedCurrency(c)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedCurrency === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {c}
                        </button>
                    ))}
                 </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 relative overflow-hidden group">
                     <p className="text-sm font-bold text-emerald-800/70 uppercase tracking-wider">本月存入 (Deposited)</p>
                     <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums font-mono">{formatCurrency(monthlyStats.depositTotal, selectedCurrency)}</p>
                     
                     <div className="mt-3 flex gap-3 text-xs text-emerald-600/60 font-medium">
                         <span>CNY: {formatCurrency(monthlyStats.currencyBreakdown.CNY.deposit, 'CNY')}</span>
                         <span>USD: {formatCurrency(monthlyStats.currencyBreakdown.USD.deposit, 'USD')}</span>
                     </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 relative overflow-hidden group">
                     <p className="text-sm font-bold text-orange-800/70 uppercase tracking-wider">本月净收益 (Net Profit)</p>
                     <p className={`text-2xl font-bold mt-1 tabular-nums font-mono ${monthlyStats.profitTotal >= 0 ? 'text-orange-700' : 'text-slate-600'}`}>{formatCurrency(monthlyStats.profitTotal, selectedCurrency)}</p>
                     <p className="text-[10px] text-orange-400 mt-0.5">收益 + 返利 + 派息 - 费用</p>
                     
                     <div className="mt-3 flex gap-3 text-xs text-orange-600/60 font-medium">
                         <span>CNY: {formatCurrency(monthlyStats.currencyBreakdown.CNY.profit, 'CNY')}</span>
                         <span>USD: {formatCurrency(monthlyStats.currencyBreakdown.USD.profit, 'USD')}</span>
                     </div>
                </div>
            </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">{year}年 {month + 1}月</h2>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('name')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'name' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>显示名称</button>
                    <button onClick={() => setViewMode('profit')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'profit' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>显示金额</button>
                    <button onClick={() => setViewMode('yield')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'yield' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>显示年化</button>
                </div>
            </div>

            <div className="grid grid-cols-7 text-center bg-slate-50 text-slate-400 text-xs py-3 border-b border-slate-100 font-semibold tracking-wider uppercase">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="grid grid-cols-7">
                {renderDays()}
            </div>
        </div>

        {/* Modal */}
        {selectedDate && (
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedDate(null)}>
                <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-800">{selectedDate}</h3>
                        <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {getEventsForSelectedDate().length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">当日无记录</div>
                        ) : (
                            <div className="space-y-2 p-2">
                                {getEventsForSelectedDate().map(ev => {
                                    let typeLabel = '';
                                    let bgColor = '';
                                    let textColor = '';
                                    
                                    if (ev.type === 'deposit') { typeLabel = '存入本金'; bgColor = 'bg-emerald-50'; textColor = 'text-emerald-700'; }
                                    else if (ev.type === 'payout') { typeLabel = '派息/分红'; bgColor = 'bg-blue-50'; textColor = 'text-blue-700'; }
                                    else if (ev.type === 'expense') { typeLabel = '费用支出'; bgColor = 'bg-red-50'; textColor = 'text-red-700'; }
                                    else if (ev.type === 'rebate') {
                                        typeLabel = ev.isReceived ? '返利(已到)' : '返利(待收)';
                                        bgColor = ev.isReceived ? 'bg-amber-100' : 'bg-amber-50';
                                        textColor = 'text-amber-800';
                                    }
                                    else { typeLabel = '到期/结算'; bgColor = 'bg-orange-50'; textColor = 'text-orange-700'; }

                                    return (
                                        <div key={ev.id} className={`p-4 rounded-xl border border-slate-100 flex justify-between items-center ${bgColor}`}>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase bg-white/50 ${textColor} border-transparent`}>{typeLabel}</span>
                                                    <span className="text-sm font-bold text-slate-700">{ev.name}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 opacity-80 font-mono">
                                                    {ev.currency === 'CNY' ? '人民币' : ev.currency}
                                                </div>
                                            </div>
                                            
                                            {/* 修正后的右侧显示逻辑 */}
                                            <div className="text-right">
                                                {/* 1. 显示本金 (仅存入和结算时显示) */}
                                                {(ev.type === 'deposit' || ev.type === 'settlement') && ev.principalAmount > 0 && (
                                                    <div className="text-sm font-medium text-slate-500 mb-1">
                                                        本金: {formatCurrency(ev.principalAmount, ev.currency)}
                                                    </div>
                                                )}
                                                
                                                {/* 2. 显示主金额 (收益/损失) */}
                                                <div className={`text-lg font-bold font-mono ${ev.type === 'deposit' ? 'text-slate-800' : ev.amount >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                                                    {ev.type === 'deposit' ? 
                                                        // 存入事件：主金额显示本金
                                                        formatCurrency(ev.principalAmount, ev.currency) :
                                                        // 其他事件：主金额显示 P&L (收益或损失)
                                                        (ev.amount >= 0 ? '+' : '-') + formatCurrency(Math.abs(ev.amount), ev.currency)
                                                    }
                                                </div>
                                                
                                                {/* 3. 显示年化收益率 */}
                                                {ev.yield && (ev.type === 'settlement' || ev.type === 'payout') && (
                                                    <div className="text-[10px] text-slate-500">
                                                        年化: {formatPercent(ev.yield)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CalendarView;