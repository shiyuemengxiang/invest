
import React, { useState, useMemo } from 'react';
import { Investment, CATEGORY_LABELS } from '../types';
import { calculateItemMetrics, formatCurrency, formatDate, formatPercent } from '../utils';
import ConfirmModal from './ConfirmModal';

interface Props {
  items: Investment[];
  onDelete: (id: string) => void;
  onEdit: (item: Investment) => void;
}

type FilterType = 'all' | 'active' | 'completed';

const InvestmentList: React.FC<Props> = ({ items, onDelete, onEdit }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter === 'active') return !item.withdrawalDate;
      if (filter === 'completed') return !!item.withdrawalDate;
      return true;
    }).sort((a, b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime());
  }, [items, filter]);

  const handleDeleteConfirm = () => {
    if (deleteId) {
        onDelete(deleteId);
        setDeleteId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-sm p-2 rounded-2xl sticky top-2 z-10 border border-white/50 shadow-sm">
        <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto">
            {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {f === 'all' ? '全部' : f === 'active' ? '在途' : '已完结'}
                </button>
            ))}
        </div>
        <div className="text-xs font-semibold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
            {filteredItems.length} Records
        </div>
      </div>

      {/* List - Responsive Card Layout */}
      <div className="grid grid-cols-1 gap-6">
        {filteredItems.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-300 shadow-inner">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-slate-400 font-medium">暂无相关记录</p>
            </div>
        )}
        
        {filteredItems.map(item => {
          const metrics = calculateItemMetrics(item);
          
          return (
            <div key={item.id} className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 relative group overflow-hidden">
              {/* Header Row */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ${metrics.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                    {item.currency === 'CNY' ? '¥' : item.currency === 'USD' ? '$' : 'HK'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 flex items-center gap-2">
                        {item.name}
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
                            {CATEGORY_LABELS[item.category]}
                        </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                         {metrics.isCompleted ? 
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                已完结
                            </span> : 
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                持仓中
                            </span>
                         }
                         <span className="text-xs text-slate-400 font-mono">{formatDate(item.depositDate)} ~ {formatDate(item.withdrawalDate || item.maturityDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount and Actions - Flexed to avoid overlap */}
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <span className="block text-2xl font-bold text-slate-800 tracking-tight font-mono">{formatCurrency(item.principal, item.currency)}</span>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Principal</span>
                    </div>
                    
                    {/* Actions - Standard flow, not absolute */}
                    <div className="flex gap-2">
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
                       {!metrics.isCompleted && (
                           <span className={`text-sm font-bold ${metrics.daysRemaining <= 7 ? 'text-orange-500' : 'text-emerald-600'}`}>
                               {metrics.daysRemaining < 0 ? '已逾期' : `${metrics.daysRemaining}天`} 
                               <span className="text-slate-400 font-normal text-xs ml-1">剩余</span>
                           </span>
                       )}
                       {metrics.isCompleted && <span className="text-sm font-bold text-slate-700">Finished</span>}
                   </div>
                </div>
                 <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Duration</p>
                   <p className="font-bold text-slate-700 text-sm">{metrics.realDurationDays} <span className="text-xs font-normal text-slate-400">Days</span></p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Return</p>
                   <div className="flex items-baseline gap-1">
                        <p className={`font-bold text-sm ${metrics.totalReturn > 0 ? 'text-orange-500' : 'text-slate-500'}`}>
                            {metrics.totalReturn > 0 ? '+' : ''}{formatCurrency(metrics.totalReturn, item.currency)}
                        </p>
                   </div>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ann. Yield</p>
                   <div className="flex flex-col">
                        <span className={`font-bold text-sm ${metrics.comprehensiveYield > 0 ? 'text-indigo-600' : metrics.hasYieldInfo ? 'text-slate-700' : 'text-slate-300'}`}>
                            {metrics.hasYieldInfo || item.rebate > 0 ? formatPercent(metrics.comprehensiveYield) : 'N/A'}
                        </span>
                        {metrics.isCompleted ? (
                             <span className="text-[10px] text-slate-400">实测年化</span>
                        ) : (
                             <span className="text-[10px] text-slate-400">
                                {metrics.hasYieldInfo ? '预估/综合' : '浮动收益'}
                             </span>
                        )}
                   </div>
                </div>
              </div>
              
              {item.notes && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2 items-start">
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
