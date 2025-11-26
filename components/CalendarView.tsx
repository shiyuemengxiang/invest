
import React, { useState, useMemo } from 'react';
import { Investment, Currency, ExchangeRates } from '../types';
import { calculateItemMetrics, formatCurrency, formatPercent, convertCurrency } from '../utils';
import { storageService } from '../services/storage';

interface Props {
  items: Investment[];
}

type ViewMode = 'name' | 'profit' | 'yield';

const CalendarView: React.FC<Props> = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('name');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  
  const rates = storageService.getRates(); // Get current rates for conversion

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // --- Monthly Statistics Calculation ---
  const monthlyStats = useMemo(() => {
      let depositTotal = 0; // Total Principal Deposited in this month
      let profitTotal = 0;  // Total Profit from items Maturing in this month
      
      const currencyBreakdown = {
          CNY: { deposit: 0, profit: 0 },
          USD: { deposit: 0, profit: 0 },
          HKD: { deposit: 0, profit: 0 }
      };

      items.forEach(item => {
          // 1. Deposits this month
          const dDate = new Date(item.depositDate);
          if (dDate.getFullYear() === year && dDate.getMonth() === month) {
              const amount = item.principal;
              depositTotal += convertCurrency(amount, item.currency, selectedCurrency, rates);
              currencyBreakdown[item.currency].deposit += amount;
          }

          // 2. Maturity/Withdrawal this month (For Profit Realization)
          // Prioritize Withdrawal Date if exists, else Maturity Date
          const endDateStr = item.withdrawalDate || item.maturityDate;
          if (endDateStr) {
              const eDate = new Date(endDateStr);
              if (eDate.getFullYear() === year && eDate.getMonth() === month) {
                   const metrics = calculateItemMetrics(item);
                   const p = metrics.profit; // Profit = Interest + Rebate
                   profitTotal += convertCurrency(p, item.currency, selectedCurrency, rates);
                   currencyBreakdown[item.currency].profit += p;
              }
          }
      });

      return { depositTotal, profitTotal, currencyBreakdown };
  }, [items, year, month, selectedCurrency, rates]);


  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return items.filter(i => i.maturityDate === dateStr || i.depositDate === dateStr);
  };

  const renderEventLabel = (ev: Investment, isMaturity: boolean) => {
    const metrics = calculateItemMetrics(ev);
    if (!isMaturity) return `存入: ${ev.name}`; // Always show name for deposit

    // For Maturity events, check view mode
    if (viewMode === 'profit') return `收: ${formatCurrency(metrics.profit, ev.currency)}`;
    if (viewMode === 'yield') return `年化: ${formatPercent(metrics.comprehensiveYield)}`;
    return `到期: ${ev.name}`;
  };

  const renderDays = () => {
    const days = [];
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 bg-slate-50/30 border border-slate-100"></div>);
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const events = getEventsForDay(d);
      const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
      
      days.push(
        <div key={d} className={`h-28 p-1.5 border border-slate-100 bg-white relative group transition hover:shadow-md hover:z-10 ${isToday ? 'bg-indigo-50/40 ring-1 ring-indigo-200' : ''}`}>
          <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
              {d}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[calc(100%-28px)] no-scrollbar">
            {events.map(ev => {
                const isMaturity = ev.maturityDate === `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const label = renderEventLabel(ev, isMaturity);
                
                return (
                    <div 
                        key={`${ev.id}-${isMaturity ? 'end' : 'start'}`} 
                        className={`text-[10px] px-1.5 py-0.5 rounded shadow-sm border truncate font-medium
                            ${isMaturity 
                                ? 'bg-orange-50 border-orange-100 text-orange-700' 
                                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            }`}
                        title={`${isMaturity ? '到期' : '存入'}: ${ev.name}`}
                    >
                        {label}
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
    <div className="space-y-6 animate-fade-in">
        
        {/* Monthly Summary Card */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                 <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {year}年 {month + 1}月 财务概览
                    </h3>
                    <p className="text-xs text-slate-400">Monthly Financial Summary</p>
                 </div>
                 
                 {/* Currency Toggle */}
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
                     <div className="absolute right-0 top-0 p-3 opacity-10">
                         <svg className="w-16 h-16 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
                     </div>
                     <p className="text-sm font-bold text-emerald-800/70 uppercase tracking-wider">本月存入 (Deposited)</p>
                     <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums font-mono">{formatCurrency(monthlyStats.depositTotal, selectedCurrency)}</p>
                     
                     <div className="mt-3 flex gap-3 text-xs text-emerald-600/60 font-medium">
                         <span>CNY: {formatCurrency(monthlyStats.currencyBreakdown.CNY.deposit, 'CNY')}</span>
                         <span>USD: {formatCurrency(monthlyStats.currencyBreakdown.USD.deposit, 'USD')}</span>
                     </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 relative overflow-hidden group">
                     <div className="absolute right-0 top-0 p-3 opacity-10">
                         <svg className="w-16 h-16 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 001-.994l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                     </div>
                     <p className="text-sm font-bold text-orange-800/70 uppercase tracking-wider">本月收益 (Realized Profit)</p>
                     <p className="text-2xl font-bold text-orange-700 mt-1 tabular-nums font-mono">{formatCurrency(monthlyStats.profitTotal, selectedCurrency)}</p>
                     
                     <div className="mt-3 flex gap-3 text-xs text-orange-600/60 font-medium">
                         <span>CNY: {formatCurrency(monthlyStats.currencyBreakdown.CNY.profit, 'CNY')}</span>
                         <span>USD: {formatCurrency(monthlyStats.currencyBreakdown.USD.profit, 'USD')}</span>
                     </div>
                </div>
            </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">{year}年 {month + 1}月</h2>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
                
                {/* Toggles */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setViewMode('name')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'name' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >
                        显示名称
                    </button>
                    <button 
                        onClick={() => setViewMode('profit')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'profit' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        显示收益
                    </button>
                    <button 
                        onClick={() => setViewMode('yield')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'yield' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        显示年化
                    </button>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 text-center bg-slate-50 text-slate-400 text-xs py-3 border-b border-slate-100 font-semibold tracking-wider uppercase">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
                {renderDays()}
            </div>
        </div>
    </div>
  );
};

export default CalendarView;
