
import React, { useState, useMemo } from 'react';
import { Investment, Currency, ExchangeRates } from '../types';
import { calculateItemMetrics, formatCurrency, formatPercent, convertCurrency } from '../utils';
import { storageService } from '../services/storage';

interface Props {
  items: Investment[];
}

type ViewMode = 'name' | 'profit' | 'yield';

// Internal Event Interface for Calendar Rendering
interface CalendarEvent {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'deposit' | 'payout' | 'settlement';
    name: string;
    amount: number; // The relevant cash flow amount for this event
    currency: Currency;
    yield?: number; // Only for settlement/payout context
    item: Investment;
}

const CalendarView: React.FC<Props> = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('name');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CNY');
  
  const rates = storageService.getRates(); 

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // --- 1. Flatten Data into Events ---
  // We process all items to generate specific events for Deposits, Transactions (Payouts), and Final Settlement.
  const allEvents = useMemo(() => {
      const events: CalendarEvent[] = [];

      items.forEach(item => {
          const metrics = calculateItemMetrics(item);

          // A. Deposit Event
          if (item.depositDate) {
              events.push({
                  id: `${item.id}-dep`,
                  date: item.depositDate,
                  type: 'deposit',
                  name: item.name,
                  amount: item.principal, // Cash Outflow
                  currency: item.currency,
                  item
              });
          }

          // B. Transaction Payout Events (Dividends, Interest)
          // We sum these up to deduct from the final maturity profit later
          let totalPayouts = 0;
          
          if (item.transactions && item.transactions.length > 0) {
              item.transactions.forEach(tx => {
                  // Only visualize Income types
                  if (tx.type === 'Dividend' || tx.type === 'Interest') {
                      const dateStr = tx.date.split('T')[0];
                      totalPayouts += tx.amount;
                      
                      events.push({
                          id: `${item.id}-tx-${tx.id}`,
                          date: dateStr,
                          type: 'payout',
                          name: item.name,
                          amount: tx.amount,
                          currency: item.currency,
                          yield: metrics.comprehensiveYield,
                          item
                      });
                  }
              });
          }

          // C. Settlement/Maturity Event
          // This happens on Withdrawal Date (if set) OR Maturity Date
          const endDate = item.withdrawalDate || item.maturityDate;
          
          if (endDate) {
              // Calculate Residual Profit: Total Expected Profit - Already Paid/Scheduled Payouts
              // If user used "Batch Generate", metrics.profit includes those amounts.
              // We want to show the *remaining* amount on the final day (e.g., Rebate, or Principal if we were tracking flow, but here we track Profit).
              // Note: metrics.profit is the Total Return (Interest + Rebate + Realized).
              
              // Floating items: profit is current value change. 
              // Fixed items: profit is total expected interest.
              
              const residualProfit = metrics.profit - totalPayouts;

              // Only show settlement if there's a meaningful amount remaining (e.g. > 1 unit)
              // OR if there were no payouts at all (standard fixed deposit)
              if (Math.abs(residualProfit) > 1 || totalPayouts === 0) {
                  events.push({
                      id: `${item.id}-end`,
                      date: endDate,
                      type: 'settlement',
                      name: item.name,
                      amount: residualProfit,
                      currency: item.currency,
                      yield: metrics.comprehensiveYield,
                      item
                  });
              }
          }
      });

      return events;
  }, [items]);

  // --- 2. Calculate Monthly Stats based on Events ---
  const monthlyStats = useMemo(() => {
      let depositTotal = 0;
      let profitTotal = 0; // This now sums up individual Payouts + Settlements
      
      const currencyBreakdown = {
          CNY: { deposit: 0, profit: 0 },
          USD: { deposit: 0, profit: 0 },
          HKD: { deposit: 0, profit: 0 }
      };

      allEvents.forEach(ev => {
          const evDate = new Date(ev.date);
          if (evDate.getFullYear() === year && evDate.getMonth() === month) {
              if (ev.type === 'deposit') {
                  depositTotal += convertCurrency(ev.amount, ev.currency, selectedCurrency, rates);
                  if (currencyBreakdown[ev.currency]) {
                      currencyBreakdown[ev.currency].deposit += ev.amount;
                  }
              } else if (ev.type === 'payout' || ev.type === 'settlement') {
                  // Both payouts (periodic) and settlements (final) count as "Profit" for that month
                  profitTotal += convertCurrency(ev.amount, ev.currency, selectedCurrency, rates);
                  if (currencyBreakdown[ev.currency]) {
                      currencyBreakdown[ev.currency].profit += ev.amount;
                  }
              }
          }
      });

      return { depositTotal, profitTotal, currencyBreakdown };
  }, [allEvents, year, month, selectedCurrency, rates]);


  // Helper to filter events for a specific grid cell
  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allEvents.filter(ev => ev.date === dateStr);
  };

  const renderEventLabel = (ev: CalendarEvent) => {
    if (ev.type === 'deposit') return `存入: ${ev.name}`;

    // For Payout/Settlement
    if (viewMode === 'profit') {
        const prefix = ev.type === 'payout' ? '收' : '结';
        return `${prefix}: ${formatCurrency(ev.amount, ev.currency)}`;
    }
    if (viewMode === 'yield') {
        // Only show yield on the final settlement or if helpful
        return `年化: ${formatPercent(ev.yield || 0)}`;
    }
    
    // Name Mode
    if (ev.type === 'payout') return `派息: ${ev.name}`;
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
                let badgeClass = '';
                if (ev.type === 'deposit') badgeClass = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                else if (ev.type === 'payout') badgeClass = 'bg-blue-50 border-blue-100 text-blue-700'; // Distinct color for periodic
                else badgeClass = 'bg-orange-50 border-orange-100 text-orange-700'; // Settlement

                return (
                    <div 
                        key={ev.id} 
                        className={`text-[10px] px-1.5 py-0.5 rounded shadow-sm border truncate font-medium ${badgeClass}`}
                        title={`${ev.name} | ${formatCurrency(ev.amount, ev.currency)}`}
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
                     <p className="text-sm font-bold text-orange-800/70 uppercase tracking-wider">本月收益 (Income & Payouts)</p>
                     <p className="text-2xl font-bold text-orange-700 mt-1 tabular-nums font-mono">{formatCurrency(monthlyStats.profitTotal, selectedCurrency)}</p>
                     <p className="text-[10px] text-orange-400 mt-0.5">含本月到期收益及周期性派息</p>
                     
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
