
import React, { useState, useMemo, useRef } from 'react';
import { Investment, CATEGORY_LABELS } from '../types';
import { calculateItemMetrics, formatCurrency, formatDate, formatPercent, filterInvestmentsByTime } from '../utils';
import ConfirmModal from './ConfirmModal';

interface Props {
  items: Investment[];
  onDelete: (id: string) => void;
  onEdit: (item: Investment) => void;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
}

type FilterType = 'all' | 'active' | 'completed';
type ProductTypeFilter = 'all' | 'Fixed' | 'Floating';

const InvestmentList: React.FC<Props> = ({ items, onDelete, onEdit, onReorder }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [productFilter, setProductFilter] = useState<ProductTypeFilter>('all');
  
  // Custom Date Filter State
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Desktop Drag State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Mobile Touch Drag State
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      // 1. Status Filter
      if (filter === 'active' && item.withdrawalDate) return false;
      if (filter === 'completed' && !item.withdrawalDate) return false;
      
      // 2. Product Type Filter
      if (productFilter !== 'all' && item.type !== productFilter) return false;

      return true;
    });

    // 3. Custom Date Filter (using helper)
    if (showCustomDate && customStart && customEnd) {
         result = filterInvestmentsByTime(result, 'custom', customStart, customEnd);
    }
    
    // Default Sort: Deposit Date ASCENDING (Oldest first) unless manually reordered
    // Note: We perform this sort ONLY if the user hasn't started manually ordering things 
    // OR strictly if filters are applied which disrupt manual order.
    // For manual sorting to work seamlessly, we generally trust the parent's array order.
    // However, to respect the "Default ASC" request, we applied a sort in previous steps.
    // If we sort here dynamically, Reordering will jump. 
    // Ideally, the "Default Sort" should happen once on data load (in App.tsx), which we implemented.
    // So here we trust the `items` order provided by parent.
    
    // Only sort if we are NOT viewing "All" (manual order is preserved for All view usually)
    // But to allow filtering, we just return result.
    return result;
  }, [items, filter, productFilter, showCustomDate, customStart, customEnd]);

  const handleDeleteConfirm = () => {
    if (deleteId) {
        onDelete(deleteId);
        setDeleteId(null);
    }
  };

  // --- Desktop Mouse Drag Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      // Create a ghost image if needed, or browser default
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); // Necessary to allow dropping
      if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
          onReorder(draggedIndex, index);
      }
      setDraggedIndex(null);
  };
  
  // --- Mobile Touch Drag Handlers ---
  const handleTouchStart = (index: number) => {
      setTouchDragIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (touchDragIndex === null) return;
      
      // Prevent scrolling while dragging to ensure smooth movement
      // Note: touch-action: none is set on the handle in CSS/Tailwind
      
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Find the closest list item row that has a data-index
      const row = element?.closest('[data-index]');
      
      if (row) {
          const targetIndexStr = row.getAttribute('data-index');
          if (targetIndexStr) {
              const targetIndex = parseInt(targetIndexStr, 10);
              
              // If we are over a different item, swap them immediately
              // This creates the "items move away" effect
              if (targetIndex !== touchDragIndex && targetIndex >= 0 && targetIndex < items.length) {
                   onReorder(touchDragIndex, targetIndex);
                   setTouchDragIndex(targetIndex); // Update active index to follow the item
              }
          }
      }
  };

  const handleTouchEnd = () => {
      setTouchDragIndex(null);
  };

  const isDragEnabled = filter === 'all' && productFilter === 'all' && !showCustomDate;

  return (
    <div className="space-y-6 animate-fade-in pb-12" ref={listRef}>
      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!deleteId}
        title="确认删除"
        message="删除后该资产记录将无法恢复。您确定要继续吗？"
        confirmText="彻底删除"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />

      {/* Filters Container */}
      <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-white/50 shadow-sm space-y-4">
          {/* Row 1: Status Tabs & Product Type Tabs */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* Status Tabs */}
                    <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
                        {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {f === 'all' ? '全部状态' : f === 'active' ? '在途' : '已完结'}
                            </button>
                        ))}
                    </div>

                    {/* Product Type Tabs */}
                    <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
                        {(['all', 'Fixed', 'Floating'] as ProductTypeFilter[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setProductFilter(p)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${productFilter === p ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {p === 'all' ? '全部类型' : p === 'Fixed' ? '固收型' : '浮动型'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setShowCustomDate(!showCustomDate)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showCustomDate ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        自定义时间筛选
                    </button>
                     <div className="text-xs font-semibold text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 whitespace-nowrap">
                        共 {filteredItems.length} 笔
                    </div>
                </div>
          </div>

          {/* Row 2: Custom Date Inputs (Conditional) */}
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
                  <button 
                    onClick={() => {setCustomStart(''); setCustomEnd(''); setShowCustomDate(false);}}
                    className="text-xs text-red-400 hover:text-red-600 ml-auto"
                  >
                    清除
                  </button>
              </div>
          )}
      </div>

      {/* List - Responsive Card Layout */}
      <div className="grid grid-cols-1 gap-4">
        {filteredItems.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-300 shadow-inner">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-slate-400 font-medium">暂无相关记录</p>
            </div>
        )}
        
        {filteredItems.map((item, index) => {
          const metrics = calculateItemMetrics(item);
          const isDragging = draggedIndex === index || touchDragIndex === index;
          
          // Determine Display Logic for Yield
          let displayYield = 'N/A';
          let displayYieldLabel = '收益率';
          let yieldColorClass = 'text-slate-300';

          if (metrics.isPending) {
              displayYield = formatPercent(metrics.annualizedYield);
              displayYieldLabel = '预计(未开始)';
              yieldColorClass = 'text-slate-400';
          } else if (metrics.isCompleted) {
              // Completed: Always show Realized Annualized Yield
              displayYield = formatPercent(metrics.comprehensiveYield);
              displayYieldLabel = '实测年化';
              yieldColorClass = metrics.comprehensiveYield > 0 ? 'text-indigo-600' : 'text-slate-500';
          } else if (item.type === 'Floating') {
              // Active Floating: Show Holding Yield (Absolute)
              displayYield = formatPercent(metrics.holdingYield);
              displayYieldLabel = '持仓收益率';
              yieldColorClass = metrics.holdingYield > 0 ? 'text-indigo-600' : 'text-slate-500';
          } else {
              // Active Fixed: Show Expected Annualized Yield
              displayYield = formatPercent(metrics.annualizedYield);
              displayYieldLabel = '预计年化';
              yieldColorClass = metrics.annualizedYield > 0 ? 'text-indigo-600' : 'text-slate-500';
          }
          
          return (
            <div 
                key={item.id} 
                data-index={index}
                draggable={isDragEnabled}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`bg-white rounded-[1.5rem] p-6 shadow-sm border transition-all duration-200 relative group overflow-hidden 
                ${isDragging ? 'opacity-90 shadow-2xl scale-[1.02] border-indigo-300 z-50 ring-2 ring-indigo-100 bg-indigo-50/10' : 'hover:shadow-lg hover:border-indigo-100'} 
                ${isDragEnabled ? 'md:cursor-grab md:active:cursor-grabbing' : ''}
                ${metrics.isPending ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-100'}
                `}
            >
              {/* Desktop Drag Handle Indicator (Visible on hover) */}
              {isDragEnabled && (
                  <div className="hidden md:block absolute left-3 top-1/2 -translate-y-1/2 text-slate-200 opacity-0 group-hover:opacity-100 transition">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                  </div>
              )}

              {/* Header Row */}
              <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10 ${isDragEnabled ? 'md:pl-4' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ${metrics.isCompleted ? 'bg-slate-100 text-slate-400' : metrics.isPending ? 'bg-slate-200 text-slate-500' : item.type === 'Floating' ? 'bg-indigo-900 text-white' : 'bg-slate-900 text-white'}`}>
                    {item.currency === 'CNY' ? '¥' : item.currency === 'USD' ? '$' : 'HK'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 flex items-center gap-2">
                        {item.name}
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${item.type === 'Floating' ? 'border-indigo-100 text-indigo-500 bg-indigo-50' : 'border-slate-200 text-slate-400'}`}>
                            {item.type === 'Floating' ? 'Floating' : 'Fixed'}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
                            {CATEGORY_LABELS[item.category]}
                        </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                         {metrics.isPending ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-300 border-dashed">
                                未入金
                            </span>
                         ) : metrics.isCompleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                已完结
                            </span> 
                         ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                持仓中
                            </span>
                         )}
                         <span className="text-xs text-slate-400 font-mono">{formatDate(item.depositDate)} ~ {formatDate(item.withdrawalDate || item.maturityDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount and Actions */}
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <span className="block text-2xl font-bold text-slate-800 tracking-tight font-mono">{formatCurrency(item.principal, item.currency)}</span>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Principal</span>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        {/* Mobile Touch Drag Handle */}
                        {isDragEnabled && (
                            <div 
                                className="md:hidden p-3 bg-slate-50 rounded-xl text-slate-300 active:bg-indigo-50 active:text-indigo-500 active:shadow-inner touch-none mr-1 cursor-move"
                                onTouchStart={() => handleTouchStart(index)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                style={{ touchAction: 'none' }} 
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                            </div>
                        )}

                        <button 
                            onClick={() => onEdit(item)}
                            className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition"
                            title="编辑"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button 
                            onClick={() => setDeleteId(item.id)}
                            className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-xl border border-slate-200 hover:border-red-200 transition"
                            title="删除"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6 py-5 border-t border-slate-50">
                <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status/Time</p>
                   <div>
                       {!metrics.isCompleted && !metrics.isPending && (
                           <span className={`text-sm font-bold ${metrics.daysRemaining <= 7 ? 'text-orange-500' : 'text-emerald-600'}`}>
                               {metrics.daysRemaining < 0 ? '已逾期' : metrics.daysRemaining === 0 ? 'Today' : `${metrics.daysRemaining}天`} 
                               <span className="text-slate-400 font-normal text-xs ml-1">剩余</span>
                           </span>
                       )}
                       {metrics.isPending && <span className="text-sm font-bold text-slate-400">未开始</span>}
                       {metrics.isCompleted && <span className="text-sm font-bold text-slate-700">Finished</span>}
                   </div>
                </div>
                 <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Duration</p>
                   <p className="font-bold text-slate-700 text-sm">{metrics.realDurationDays} <span className="text-xs font-normal text-slate-400">Days</span></p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                       {metrics.isCompleted ? 'Realized Profit' : metrics.isPending ? 'Potential' : item.type === 'Floating' ? 'Current Profit' : 'Est. Profit'}
                   </p>
                   <div className="flex flex-col gap-0.5">
                        {/* Primary Return Display */}
                        <div className="flex items-baseline gap-1">
                            <p className={`font-bold text-sm ${metrics.isPending ? 'text-slate-400' : metrics.totalReturn > 0 ? 'text-orange-500' : 'text-slate-500'}`}>
                                {metrics.totalReturn > 0 ? '+' : ''}{formatCurrency(metrics.totalReturn, item.currency)}
                            </p>
                        </div>
                        {/* For Active Fixed: Show Accrued Interest Today */}
                        {!metrics.isCompleted && !metrics.isPending && item.type === 'Fixed' && (
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">截止今日:</span>
                                <span className="text-[10px] font-bold text-slate-600">
                                    {formatCurrency(metrics.accruedReturn, item.currency)}
                                </span>
                            </div>
                        )}
                   </div>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Yield</p>
                   <div className="flex flex-col">
                        <span className={`font-bold text-sm ${yieldColorClass}`}>
                            {displayYield}
                        </span>
                        <span className="text-[10px] text-slate-400">
                             {displayYieldLabel}
                        </span>
                   </div>
                </div>
              </div>
              
              {/* Unit Cost & Current Price for Stocks/Funds */}
              {item.quantity && item.quantity > 0 && (
                  <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6 py-4 mt-2 bg-slate-50/80 rounded-xl px-4 border border-dashed border-slate-200">
                      <div className="space-y-0.5">
                           <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Holdings</p>
                           <p className="font-mono text-xs font-bold text-slate-700">{item.quantity} 股/份</p>
                      </div>
                      <div className="space-y-0.5">
                           <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cost Price</p>
                           <p className="font-mono text-xs font-bold text-slate-700">{formatCurrency(metrics.unitCost, item.currency)}</p>
                      </div>
                      <div className="space-y-0.5">
                           <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Current Price</p>
                           <div className="flex items-center gap-1">
                               <p className={`font-mono text-xs font-bold ${metrics.currentPrice >= metrics.unitCost ? 'text-orange-600' : 'text-emerald-600'}`}>
                                   {formatCurrency(metrics.currentPrice, item.currency)}
                               </p>
                               <span className={`text-[9px] px-1 rounded ${metrics.currentPrice >= metrics.unitCost ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                   {metrics.unitCost > 0 ? ((metrics.currentPrice - metrics.unitCost)/metrics.unitCost * 100).toFixed(1) : 0}%
                               </span>
                           </div>
                      </div>
                  </div>
              )}
              
              {item.notes && (
                  <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2 items-start">
                      <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                      {item.notes}
                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InvestmentList;
