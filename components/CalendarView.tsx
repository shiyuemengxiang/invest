import React, { useState } from 'react';
import { Investment } from '../types';
import { calculateItemMetrics, formatCurrency, formatPercent } from '../utils';

interface Props {
  items: Investment[];
}

type ViewMode = 'name' | 'profit' | 'yield';

const CalendarView: React.FC<Props> = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('name');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

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
      
      // Calculate daily stats if in profit mode? Optional enhancement
      
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
    <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden animate-fade-in">
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
  );
};

export default CalendarView;
