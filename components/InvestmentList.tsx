import React, { useMemo, useEffect, useState } from 'react';
import { Investment, CATEGORY_LABELS, Currency, InvestmentCategory, FilterType, ProductTypeFilter, CurrencyFilter, CategoryFilter, SortType } from '../types';
import { calculateItemMetrics, formatCurrency, formatDate, formatPercent, filterInvestmentsByTime, calculateDailyReturn } from '../utils';
import ConfirmModal from './ConfirmModal';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProps } from '@hello-pangea/dnd';

interface Props {
  items: Investment[];
  onDelete: (id: string) => void;
  onEdit: (item: Investment) => void;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  onRefreshMarket: (silent?: boolean) => void;
  
  filter: FilterType; setFilter: (v: FilterType) => void;
  productFilter: ProductTypeFilter; setProductFilter: (v: ProductTypeFilter) => void;
  currencyFilter: CurrencyFilter; setCurrencyFilter: (v: CurrencyFilter) => void;
  categoryFilter: CategoryFilter; setCategoryFilter: (v: CategoryFilter) => void;
  sortType: SortType; setSortType: (v: SortType) => void;
  showCustomDate: boolean; setShowCustomDate: (v: boolean) => void;
  customStart: string; setCustomStart: (v: string) => void;
  customEnd: string; setCustomEnd: (v: string) => void;
}

const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

interface SummaryStats {
    totalProfit: number;
    dailyReturn: number;
    pendingRebate: number;
}

const InvestmentList: React.FC<Props> = ({ 
    items, onDelete, onEdit, onReorder, onRefreshMarket,
    filter, setFilter,
    productFilter, setProductFilter,
    currencyFilter, setCurrencyFilter,
    categoryFilter, setCategoryFilter,
    sortType, setSortType,
    showCustomDate, setShowCustomDate,
    customStart, setCustomStart,
    customEnd, setCustomEnd
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      if (filter === 'active' && item.withdrawalDate) return false;
      if (filter === 'completed' && item.withdrawalDate === null) return false;
      
      if (productFilter !== 'all' && item.type !== productFilter) return false;
      if (currencyFilter !== 'all' && item.currency !== currencyFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      return true;
    });

    if (showCustomDate && customStart && customEnd) {
         result = filterInvestmentsByTime(result, 'custom', customStart, customEnd);
    }
    
    if (sortType === 'date-asc') {
        result.sort((a, b) => new Date(a.depositDate).getTime() - new Date(b.depositDate).getTime());
    } else if (sortType === 'date-desc') {
        result.sort((a, b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime());
    }
    
    return result;
  }, [items, filter, productFilter, currencyFilter, categoryFilter, showCustomDate, customStart, customEnd, sortType]);

  const summaryStats = useMemo((): Record<Currency, SummaryStats> => {
      const stats: Record<Currency, SummaryStats> = {
          CNY: { totalProfit: 0, dailyReturn: 0, pendingRebate: 0 },
          USD: { totalProfit: 0, dailyReturn: 0, pendingRebate: 0 },
          HKD: { totalProfit: 0, dailyReturn: 0, pendingRebate: 0 }
      };

      filteredItems.forEach(item => {
          const metrics = calculateItemMetrics(item);
          const daily = calculateDailyReturn(item);

          // metrics.profit = baseInterest + item.rebate + item.totalRealizedProfit (Total Lifetime P&L including ALL rebate)
          
          // 1. Calculate Base P&L (Excluding ALL Rebate)
          const baseProfit = metrics.profit - item.rebate; 
          
          // 2. Add back only RECEIVED rebate (Total Estimated Profit = Base P&L + RECEIVED Rebate)
          const receivedRebate = item.isRebateReceived ? item.rebate : 0;
          let profit = baseProfit + receivedRebate;
          
          // 3. Calculate Pending Rebate amount
          const pendingRebate = item.isRebateReceived ? 0 : item.rebate;

          if (stats[item.currency]) {
              stats[item.currency].totalProfit += profit;
              stats[item.currency].dailyReturn += daily;
              stats[item.currency].pendingRebate += pendingRebate; 
          }
      });

      return stats;
  }, [filteredItems]);


  const handleDeleteConfirm = () => {
    if (deleteId) {
        onDelete(deleteId);
        setDeleteId(null);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    onReorder(result.source.index, result.destination.index);
  };
  
  const handleRefreshClick = async () => {
      setIsRefreshing(true);
      await onRefreshMarket(false); 
      setTimeout(() => setIsRefreshing(false), 1000); 
  };

  const isFiltersActive = filter !== 'all' || productFilter !== 'all' || currencyFilter !== 'all' || categoryFilter !== 'all' || showCustomDate;
  const isDragEnabled = sortType === 'custom' && !isFiltersActive;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <ConfirmModal 
        isOpen={!!deleteId}
        title="确认删除"
        message="删除后该资产记录将无法恢复。您确定要继续吗？"
        confirmText="彻底删除"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />

      <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-white/50 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
                        {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {f === 'all' ? '全部' : f === 'active' ? '在途' : '已完结'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
                        {(['all', 'CNY', 'USD', 'HKD'] as CurrencyFilter[]).map(c => (
                            <button
                                key={c}
                                onClick={() => setCurrencyFilter(c)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currencyFilter === c ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {c === 'all' ? '全部币种' : c}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    <button
                        onClick={handleRefreshClick}
                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors ${isRefreshing ? 'opacity-70 cursor-wait' : ''}`}
                        title="刷新市场数据"
                        disabled={isRefreshing}
                    >
                        <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {isRefreshing ? '更新中...' : '刷新行情'}
                    </button>
                     <div className="text-xs font-semibold text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 whitespace-nowrap">
                        共 {filteredItems.length} 笔
                    </div>
                </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
                    <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
                        {(['all', 'Fixed', 'Floating'] as ProductTypeFilter[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setProductFilter(p)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${productFilter === p ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {p === 'all' ? '全部类型' : p === 'Fixed' ? '固收型' : '浮动型'}
                            </button>
                        ))}
                    </div>

                     <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                        className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-slate-200 border-none h-[34px]"
                     >
                        <option value="all">所有分类</option>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>

                    <select 
                        value={sortType}
                        onChange={(e) => setSortType(e.target.value as SortType)}
                        className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-slate-200 border-none h-[34px]"
                    >
                        <option value="date-asc">买入时间升序</option>
                        <option value="date-desc">买入时间降序</option>
                        <option value="custom">自定义排序 (可拖拽)</option>
                    </select>
                </div>

                <button 
                    onClick={() => setShowCustomDate(!showCustomDate)}
                    className={`w-full lg:w-auto flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showCustomDate ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    自定义时间
                </button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-4">
             {(['CNY', 'USD', 'HKD'] as Currency[]).filter(c => currencyFilter === 'all' || currencyFilter === c).map(c => {
                 const s = summaryStats[c];
                 const shouldDisplay = s && (s.totalProfit !== 0 || s.dailyReturn !== 0 || s.pendingRebate !== 0);
                 if (!shouldDisplay && currencyFilter !== 'all' && c !== 'CNY') return null;
                 if (currencyFilter === 'all' && !shouldDisplay && c !== 'CNY') return null;

                 return (
                     <div key={c} className="flex flex-col gap-2 p-2 rounded-xl border border-slate-100 bg-white/50">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{c} Summary</span>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
                             {/* 1. 累计收益 (预估) - UPDATED TIP */}
                             <div className="text-left relative group">
                                 <div className="flex items-center gap-1">
                                     <p className="text-[10px] text-slate-500 font-semibold">累计收益 (预估)</p>
                                     <svg className="w-3 h-3 text-slate-300 transition-colors group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 </div>
                                 {/* Tooltip */}
                                 <div className="absolute left-0 bottom-full mb-2 w-max max-w-xs p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
                                     包含已到账返利、已落袋交易盈亏、以及所有产品至今日的预估收益（固收利息/浮动浮盈）。
                                 </div>
                                 <p className={`font-mono font-bold text-lg ${s.totalProfit >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                     {formatCurrency(s.totalProfit, c)}
                                 </p>
                             </div>
                             
                             {/* 2. 昨日/今日收益 */}
                             <div className="text-left">
                                 <p className="text-[10px] text-slate-500 font-semibold">昨日/今日收益</p>
                                 <p className={`font-mono font-bold text-lg ${s.dailyReturn >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                     {s.dailyReturn >= 0 ? '+' : ''}{formatCurrency(s.dailyReturn, c)}
                                 </p>
                             </div>
                             
                             {/* 3. 未到账返利总额 - NEW FIELD */}
                             <div className="text-left">
                                 <p className="text-[10px] text-slate-500 font-semibold">未到账返利</p>
                                 <p className={`font-mono font-bold text-lg ${s.pendingRebate > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                                     {s.pendingRebate > 0 ? '+' : ''}{formatCurrency(s.pendingRebate, c)}
                                 </p>
                             </div>
                         </div>
                     </div>
                 );
             })}
             {/* FIX: Corrected variable name from 'stats' to 'summaryStats' */}
             {currencyFilter === 'all' && Object.values(summaryStats).every((s) => s.totalProfit === 0 && s.dailyReturn === 0 && s.pendingRebate === 0) && (
                 <span className="text-xs text-slate-400">暂无收益数据</span>
             )}
          </div>

          {showCustomDate && (
              <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-fade-in">
                  <span className="text-xs font-bold text-slate-400 uppercase">Range:</span>
                  <input 
                    type="date" 
                    value={customStart} 
                    onChange={e => setCustomStart(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none w-full"
                  />
                  <span className="text-slate-300">-</span>
                  <input 
                    type="date" 
                    value={customEnd} 
                    onChange={e => setCustomEnd(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-400 outline-none w-full"
                  />
                  <button 
                    onClick={() => {setCustomStart(''); setCustomEnd(''); setShowCustomDate(false);}}
                    className="text-xs text-red-400 hover:text-red-600 ml-auto whitespace-nowrap"
                  >
                    清除筛选
                  </button>
              </div>
          )}
      </div>
      
      {!isDragEnabled && sortType === 'custom' && (
          <div className="text-center text-xs text-orange-400 bg-orange-50 py-2 rounded-xl border border-orange-100">
              提示: 筛选或自定义时间模式下无法进行拖拽排序，请重置筛选条件。
          </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <StrictModeDroppable droppableId="investment-list">
            {(provided) => (
                <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    className="grid grid-cols-1 gap-4"
                >
                    {filteredItems.map((item, index) => {
                        const metrics = calculateItemMetrics(item);
                        
                        let displayYield = 'N/A';
                        let displayYieldLabel = '收益率';
                        let yieldColorClass = 'text-slate-300';
                        let yieldBasisNote = '';

                        if (metrics.isPending) {
                            displayYield = formatPercent(metrics.annualizedYield);
                            displayYieldLabel = '预计(未开始)';
                            yieldColorClass = 'text-slate-400';
                        } else if (metrics.isCompleted) {
                            displayYield = formatPercent(metrics.comprehensiveYield);
                            displayYieldLabel = '实测年化';
                            yieldColorClass = metrics.comprehensiveYield > 0 ? 'text-indigo-600' : 'text-slate-500';
                        } else if (item.type === 'Floating') {
                            displayYield = formatPercent(metrics.holdingYield);
                            displayYieldLabel = '持仓收益率';
                            yieldColorClass = metrics.holdingYield > 0 ? 'text-indigo-600' : 'text-slate-500';
                            if (item.category === 'Fund') yieldBasisNote = '(基于NAV)';
                        } else {
                            displayYield = formatPercent(metrics.annualizedYield);
                            displayYieldLabel = '预计年化';
                            yieldColorClass = metrics.annualizedYield > 0 ? 'text-indigo-600' : 'text-slate-500';
                        }
                        
                        const estPrice = item.category === 'Fund' && item.estGrowth !== undefined 
                            ? metrics.currentPrice * (1 + item.estGrowth / 100)
                            : undefined;

                        return (
                            <Draggable 
                                key={item.id} 
                                draggableId={item.id} 
                                index={index} 
                                isDragDisabled={!isDragEnabled}
                            >
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`bg-white rounded-[1.5rem] p-6 shadow-sm border transition-all duration-200 relative group overflow-hidden 
                                        ${snapshot.isDragging ? 'opacity-90 shadow-2xl scale-[1.02] border-indigo-300 z-50 ring-2 ring-indigo-100 bg-indigo-50/10' : 'hover:shadow-lg hover:border-indigo-100'} 
                                        ${metrics.isPending ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-100'}
                                        `}
                                        style={provided.draggableProps.style}
                                    >
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
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

                                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                                <div className="text-right">
                                                    <span className="block text-2xl font-bold text-slate-800 tracking-tight font-mono">{formatCurrency(item.currentPrincipal, item.currency)}</span>
                                                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Principal</span>
                                                </div>
                                                
                                                <div className="flex gap-2 items-center">
                                                    {isDragEnabled && (
                                                        <div 
                                                            {...provided.dragHandleProps}
                                                            className="p-3 bg-slate-50 rounded-xl text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-grab active:cursor-grabbing touch-none"
                                                            title="拖拽排序"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
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

                                        <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-4 py-5 border-t border-slate-50">
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
                                                    <div className="flex items-baseline gap-1">
                                                        <p className={`font-bold text-sm ${metrics.isPending ? 'text-slate-400' : metrics.totalReturn > 0 ? 'text-orange-500' : metrics.totalReturn < 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                                                            {metrics.totalReturn !== 0 ? (metrics.totalReturn > 0 ? '+' : '') + formatCurrency(metrics.totalReturn, item.currency) : '-'}
                                                        </p>
                                                    </div>
                                                    {!metrics.isCompleted && !metrics.isPending && item.type === 'Fixed' && metrics.accruedReturn > 0.01 && (
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
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold text-sm ${yieldColorClass}`}>
                                                            {displayYield}
                                                        </span>
                                                        {yieldBasisNote && (
                                                            <span className="text-[10px] text-red-500 bg-red-50 px-1 rounded border border-red-100 whitespace-nowrap">
                                                                {yieldBasisNote}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">
                                                        {displayYieldLabel}
                                                    </span>
                                            </div>
                                            </div>
                                        </div>
                                        
                                        {(item.quantity || 0) > 0 && (
                                            <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-4 py-4 mt-2 bg-slate-50/80 rounded-xl px-4 border border-dashed border-slate-200">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Holdings</p>
                                                    <p className="font-mono text-xs font-bold text-slate-700">{item.quantity} {item.symbol ? `(${item.symbol})` : '股/份'}</p>
                                                </div>

                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cost Price</p>
                                                    <p className="font-mono text-xs font-bold text-slate-700">{formatCurrency(metrics.unitCost, item.currency)}</p>
                                                </div>

                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                                        {item.category === 'Fund' ? '最新净值 (NAV)' : 'Current Price'}
                                                    </p>
                                                    <p className={`font-mono text-xs font-bold ${metrics.currentPrice >= metrics.unitCost ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {formatCurrency(metrics.currentPrice, item.currency)}
                                                    </p>
                                                </div>

                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                                        {item.category === 'Fund' ? '实时估值 (Est)' : 'Today\'s Change'}
                                                    </p>
                                                    
                                                    {item.estGrowth !== undefined ? (
                                                        <div className="flex flex-col gap-1">
                                                            {estPrice && (
                                                                <span className={`font-mono text-xs font-bold ${item.estGrowth >= 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                                    {formatCurrency(estPrice, item.currency)}
                                                                </span>
                                                            )}
                                                            
                                                            <div className={`flex items-center gap-1 w-fit px-1.5 py-0.5 rounded ${item.estGrowth >= 0 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                <span className="text-[9px] opacity-75 font-bold scale-90">估</span>
                                                                <span className="text-[10px] font-bold font-mono">{item.estGrowth >= 0 ? '+' : ''}{item.estGrowth.toFixed(2)}%</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        item.isAutoQuote ? (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">
                                                                暂无估值
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300">-</span>
                                                        )
                                                    )}
                                                </div>
                                                
                                                 <div className="space-y-0.5">
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Return %</p>
                                                    <span className={`text-xs font-bold ${metrics.currentPrice >= metrics.unitCost ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {metrics.unitCost > 0 ? ((metrics.currentPrice - metrics.unitCost)/metrics.unitCost * 100).toFixed(2) : 0}%
                                                    </span>
                                                 </div>
                                            </div>
                                        )}
                                        
                                        {item.notes && (
                                            <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2 items-start">
                                                <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                                {item.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Draggable>
                        );
                    })}
                    {provided.placeholder}
                </div>
            )}
        </StrictModeDroppable>
      </DragDropContext>
    </div>
  );
};

export default InvestmentList;