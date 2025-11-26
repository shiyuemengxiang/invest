
import React, { useState, useEffect } from 'react';
import { Investment, Transaction, CATEGORY_LABELS, TransactionType } from '../types';
import { recalculateInvestmentState, formatCurrency } from '../utils';

interface Props {
  onSave: (item: Investment) => void;
  onCancel: () => void;
  initialData?: Investment | null;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const getCurrentLocalISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 16);
};

const InvestmentForm: React.FC<Props> = ({ onSave, onCancel, initialData, onNotify }) => {
    const [formData, setFormData] = useState<Investment>(() => {
        if (initialData) {
            return recalculateInvestmentState(initialData);
        }
        return {
            id: self.crypto.randomUUID(),
            name: '',
            category: 'Fixed',
            type: 'Fixed',
            currency: 'CNY',
            depositDate: new Date().toISOString().split('T')[0],
            maturityDate: '',
            withdrawalDate: null,
            principal: 0,
            currentPrincipal: 0,
            totalCost: 0,
            totalRealizedProfit: 0,
            transactions: [],
            interestBasis: '365',
            notes: '',
            rebate: 0,
            isRebateReceived: false
        };
    });

    const [showBatchForm, setShowBatchForm] = useState(false);
    const [batchConfig, setBatchConfig] = useState({
        mode: 'fixed', // 'fixed' | 'rate' | 'annual'
        amount: 0,
        rate: 0,
        type: 'Dividend' as TransactionType,
        frequency: 'monthly', // weekly, monthly, quarterly, yearly
        startDate: '',
        endDate: '',
        count: 12
    });
    
    // Auto-fill rate when opening batch form
    useEffect(() => {
        if (showBatchForm && formData.expectedRate) {
            setBatchConfig(prev => ({ ...prev, rate: formData.expectedRate || 0, mode: 'annual' }));
        }
    }, [showBatchForm]);

    // Update computed state whenever transactions change
    useEffect(() => {
        setFormData(prev => recalculateInvestmentState(prev));
    }, [formData.transactions]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleTransactionChange = (index: number, field: keyof Transaction, value: any) => {
        const newTransactions = [...(formData.transactions || [])];
        newTransactions[index] = { ...newTransactions[index], [field]: value };
        setFormData({ ...formData, transactions: newTransactions });
    };

    const addTransaction = () => {
        const newTx: Transaction = {
            id: self.crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            type: 'Buy',
            amount: 0,
            notes: ''
        };
        setFormData({ ...formData, transactions: [...(formData.transactions || []), newTx] });
    };

    const removeTransaction = (index: number) => {
        const newTransactions = [...(formData.transactions || [])];
        newTransactions.splice(index, 1);
        setFormData({ ...formData, transactions: newTransactions });
    };

    const handleClearFutureDividends = () => {
      if (!window.confirm("确定要清除所有日期在今天之后的派息/分红记录吗？\n\n当本金发生变动时，建议清除旧计划并重新生成。")) return;

      const todayStr = getCurrentLocalISO().split('T')[0];
      
      const currentTxs = formData.transactions && formData.transactions.length > 0
          ? [...formData.transactions] 
          : [];

      const keptTxs = currentTxs.filter(tx => {
          if (tx.type !== 'Dividend') return true;
          const txDate = tx.date.split('T')[0];
          return txDate <= todayStr;
      });

      const removedCount = currentTxs.length - keptTxs.length;
      
      setFormData({ ...formData, transactions: keptTxs });
      onNotify(`已清除 ${removedCount} 条未来派息记录`, "info");
    };

    const handleSaveBatch = () => {
        const newTxs: Transaction[] = [];
        let currentDate = new Date(batchConfig.startDate);
        const endDate = batchConfig.endDate ? new Date(batchConfig.endDate) : null;
        
        let count = 0;
        const maxCount = batchConfig.count || 100;

        while (count < maxCount) {
            if (endDate && currentDate > endDate) break;

            let txAmount = 0;
            if (batchConfig.mode === 'fixed') {
                txAmount = Number(batchConfig.amount);
            } else if (batchConfig.mode === 'annual') {
                // Annual Rate based calculation
                const principal = formData.currentPrincipal;
                const rateVal = Number(batchConfig.rate) / 100;
                
                if (batchConfig.frequency === 'weekly') {
                    // Precise Weekly: Principal * Rate / Basis * 7
                    const basis = Number(formData.interestBasis || 365);
                    txAmount = (principal * rateVal / basis) * 7;
                } else {
                    // Standard Division for Monthly/Quarterly/Yearly
                    let divisor = 1;
                    if (batchConfig.frequency === 'monthly') divisor = 12;
                    else if (batchConfig.frequency === 'quarterly') divisor = 4;
                    
                    txAmount = (principal * rateVal) / divisor;
                }
                txAmount = parseFloat(txAmount.toFixed(2));
            } else {
                // Single Period Rate: Principal * Rate%
                txAmount = formData.currentPrincipal * (Number(batchConfig.rate) / 100);
                txAmount = parseFloat(txAmount.toFixed(2));
            }

            newTxs.push({
                id: self.crypto.randomUUID(),
                date: currentDate.toISOString().split('T')[0],
                type: batchConfig.type,
                amount: txAmount,
                notes: `Batch: ${batchConfig.mode === 'fixed' ? 'Fixed' : `${batchConfig.rate}%/${batchConfig.mode === 'annual' ? 'Yr' : 'Pd'}`}`
            });

            // Increment date
            if (batchConfig.frequency === 'weekly') currentDate.setDate(currentDate.getDate() + 7);
            else if (batchConfig.frequency === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
            else if (batchConfig.frequency === 'quarterly') currentDate.setMonth(currentDate.getMonth() + 3);
            else if (batchConfig.frequency === 'yearly') currentDate.setFullYear(currentDate.getFullYear() + 1);
            else currentDate.setDate(currentDate.getDate() + 30); 

            count++;
        }

        setFormData({ ...formData, transactions: [...(formData.transactions || []), ...newTxs] });
        setShowBatchForm(false);
        onNotify(`已生成 ${newTxs.length} 条记录`, "success");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(recalculateInvestmentState(formData));
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 animate-fade-in max-w-4xl mx-auto">
           {/* Header */}
           <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
               {initialData ? '编辑资产' : '新增资产'}
               <span className="text-sm font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                   {formData.type === 'Fixed' ? '固收模式' : '浮动模式'}
               </span>
           </h2>
           
           <form onSubmit={handleSubmit} className="space-y-8">
                {/* Section 1: Basic Information (Grid Layout) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">资产名称</label>
                        <input name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-200 outline-none transition" required placeholder="例如: 招商银行定存" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">分类</label>
                            <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none">
                                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">类型</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none">
                                <option value="Fixed">固收型</option>
                                <option value="Floating">浮动型</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">币种</label>
                            <select name="currency" value={formData.currency} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none">
                                <option value="CNY">CNY</option>
                                <option value="USD">USD</option>
                                <option value="HKD">HKD</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section 2: Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">开始日期 (Deposit)</label>
                        <input type="date" name="depositDate" value={formData.depositDate} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required />
                     </div>
                     
                     {/* Maturity is primary for Fixed, optional for Floating */}
                     <div className={formData.type === 'Floating' ? 'opacity-70' : ''}>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            到期日期 (Maturity)
                            {formData.type === 'Floating' && <span className="text-xs font-normal text-slate-400 ml-1">(选填)</span>}
                        </label>
                        <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" />
                     </div>

                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            已完结日期 (Exit)
                            <span className="text-xs font-normal text-slate-400 ml-1">(选填)</span>
                        </label>
                        <input type="date" name="withdrawalDate" value={formData.withdrawalDate || ''} onChange={handleInputChange} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" />
                     </div>
                </div>

                {/* Section 3: Type Specifics (Clean Layout) */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    
                    {/* Fixed Income Row */}
                    {formData.type === 'Fixed' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">预期年化 (%)</label>
                                <div className="relative">
                                    <input type="number" step="0.01" name="expectedRate" value={formData.expectedRate || ''} onChange={handleInputChange} className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="0.00" />
                                    <span className="absolute right-4 top-3.5 text-slate-400 text-sm">%</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">计息基准 (Days)</label>
                                <select name="interestBasis" value={formData.interestBasis || '365'} onChange={handleInputChange} className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none">
                                    <option value="365">365天 / 年</option>
                                    <option value="360">360天 / 年 (银行)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Floating Asset Row */}
                    {formData.type === 'Floating' && (
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    行情代码 (Symbol) 
                                    <span className="text-xs font-normal text-slate-400 ml-2">支持 sh/sz/bj, 基金代码, 美股代码</span>
                                </label>
                                <div className="flex gap-3">
                                    <input name="symbol" value={formData.symbol || ''} onChange={handleInputChange} className="flex-1 p-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="如: sh600519, 000001, AAPL" />
                                    
                                    {/* Auto Quote Toggle Button */}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isAutoQuote: !formData.isAutoQuote })}
                                        className={`px-4 rounded-xl border flex items-center gap-2 transition-all ${
                                            formData.isAutoQuote 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                            : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${formData.isAutoQuote ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                        <span className="text-sm font-bold">自动行情</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rebate Row (Common) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">返利/红包 (Rebate)</label>
                        <div className="flex gap-3">
                            <input type="number" step="0.01" name="rebate" value={formData.rebate || ''} onChange={handleInputChange} className="flex-1 p-3 bg-white rounded-xl border border-slate-200 outline-none" placeholder="0.00" />
                            
                            {/* Rebate Received Toggle Button */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isRebateReceived: !formData.isRebateReceived })}
                                className={`px-4 rounded-xl border flex items-center gap-2 transition-all ${
                                    formData.isRebateReceived 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-3 h-3 rounded-full ${formData.isRebateReceived ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className="text-sm font-bold">{formData.isRebateReceived ? '已到账' : '未到账'}</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Section 4: Live Stats Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">当前本金</p>
                        <p className="text-lg font-bold text-slate-800 font-mono">{formatCurrency(formData.currentPrincipal, formData.currency)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">持仓份额</p>
                        <p className="text-lg font-bold text-slate-800 font-mono">{formData.currentQuantity || 0}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">累计投入</p>
                        <p className="text-lg font-bold text-slate-800 font-mono">{formatCurrency(formData.totalCost, formData.currency)}</p>
                    </div>
                     <div className="text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">已落袋收益</p>
                        <p className={`text-lg font-bold font-mono ${formData.totalRealizedProfit >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {formatCurrency(formData.totalRealizedProfit, formData.currency)}
                        </p>
                    </div>
                </div>

                {/* Section 5: Transactions (Advanced) */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            交易流水 (Transactions)
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowBatchForm(!showBatchForm)} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-bold border border-purple-100 transition">
                                ⚡ 批量生成工具
                            </button>
                            <button type="button" onClick={addTransaction} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-bold transition">
                                + 添加记录
                            </button>
                        </div>
                    </div>
                    
                    {/* Batch Generator UI */}
                    {showBatchForm && (
                        <div className="mb-4 bg-purple-50 p-5 rounded-2xl border border-purple-100 animate-fade-in shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-purple-800">批量生成流水 (Batch Generator)</h4>
                                <button type="button" onClick={() => setShowBatchForm(false)} className="text-purple-400 hover:text-purple-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-purple-700 block mb-1.5">交易类型</label>
                                    <select value={batchConfig.type} onChange={e => setBatchConfig({...batchConfig, type: e.target.value as TransactionType})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none">
                                        <option value="Dividend">分红/派息 (Dividend)</option>
                                        <option value="Interest">利息 (Interest)</option>
                                        <option value="Buy">定投/存入 (Buy)</option>
                                        <option value="Fee">费用 (Fee)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-purple-700 block mb-1.5">计算模式</label>
                                    <select value={batchConfig.mode} onChange={e => setBatchConfig({...batchConfig, mode: e.target.value})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none">
                                        <option value="annual">年化利率 (自动按周期分摊)</option>
                                        <option value="fixed">固定金额 (Fixed Amount)</option>
                                        <option value="rate">单期比例 (Single Period %)</option>
                                    </select>
                                </div>
                                {batchConfig.mode === 'fixed' ? (
                                    <div>
                                        <label className="text-xs font-bold text-purple-700 block mb-1.5">单次金额</label>
                                        <input type="number" value={batchConfig.amount} onChange={e => setBatchConfig({...batchConfig, amount: parseFloat(e.target.value)})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none" placeholder="0.00" />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-bold text-purple-700 block mb-1.5">
                                            {batchConfig.mode === 'annual' ? '年化利率 (%)' : '单次比例 (%)'}
                                        </label>
                                        <input type="number" value={batchConfig.rate} onChange={e => setBatchConfig({...batchConfig, rate: parseFloat(e.target.value)})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none" placeholder="e.g. 4.0" />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-purple-700 block mb-1.5">频率</label>
                                    <select value={batchConfig.frequency} onChange={e => setBatchConfig({...batchConfig, frequency: e.target.value})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none">
                                        <option value="monthly">每月 (Monthly) / 12</option>
                                        <option value="quarterly">每季 (Quarterly) / 4</option>
                                        <option value="weekly">每周 (Weekly) / 52</option>
                                        <option value="yearly">每年 (Yearly) / 1</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-purple-700 block mb-1.5">开始日期</label>
                                    <input type="date" value={batchConfig.startDate} onChange={e => setBatchConfig({...batchConfig, startDate: e.target.value})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-purple-700 block mb-1.5">生成数量 (期)</label>
                                    <input type="number" value={batchConfig.count} onChange={e => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className="w-full p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <button 
                                    type="button" 
                                    onClick={handleClearFutureDividends}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium underline decoration-red-200 underline-offset-2"
                                >
                                    清除今天以后的预估记录
                                </button>
                                <button type="button" onClick={handleSaveBatch} className="px-5 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 shadow-md shadow-purple-200 transition active:scale-95">立即生成</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 overflow-x-auto custom-scrollbar pb-2">
                        {formData.transactions?.map((tx, index) => (
                            <div key={tx.id || index} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100 min-w-[600px]">
                                <select 
                                    value={tx.type} 
                                    onChange={(e) => handleTransactionChange(index, 'type', e.target.value)}
                                    className="text-xs p-2 rounded-lg border border-slate-200 w-28 bg-white font-medium"
                                >
                                    <option value="Buy">买入/存入</option>
                                    <option value="Sell">卖出/赎回</option>
                                    <option value="Dividend">派息/分红</option>
                                    <option value="Interest">利息</option>
                                    <option value="Fee">手续费</option>
                                </select>
                                <input 
                                    type="datetime-local" 
                                    value={tx.date.length > 16 ? tx.date.slice(0, 16) : tx.date}
                                    onChange={(e) => handleTransactionChange(index, 'date', e.target.value)}
                                    className="text-xs p-2 rounded-lg border border-slate-200 w-40 bg-white font-mono"
                                />
                                <div className="relative flex-1 min-w-[100px]">
                                    <input 
                                        type="number" 
                                        placeholder="金额"
                                        value={tx.amount || ''} 
                                        onChange={(e) => handleTransactionChange(index, 'amount', parseFloat(e.target.value))}
                                        className="text-xs p-2 rounded-lg border border-slate-200 w-full bg-white font-mono font-bold text-slate-700"
                                    />
                                </div>
                                <div className="relative w-24">
                                    <input 
                                        type="number" 
                                        placeholder="份额 Qty"
                                        value={tx.quantity || ''} 
                                        onChange={(e) => handleTransactionChange(index, 'quantity', parseFloat(e.target.value))}
                                        className="text-xs p-2 rounded-lg border border-slate-200 w-full bg-white font-mono"
                                    />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="备注..."
                                    value={tx.notes || ''} 
                                    onChange={(e) => handleTransactionChange(index, 'notes', e.target.value)}
                                    className="text-xs p-2 rounded-lg border border-slate-200 flex-[2] bg-white min-w-[150px]"
                                />
                                <button type="button" onClick={() => removeTransaction(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                        {(!formData.transactions || formData.transactions.length === 0) && (
                            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                暂无交易流水，请点击上方“添加记录”或“批量生成”
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-6 border-t border-slate-100 flex gap-4 justify-end">
                    <button type="button" onClick={onCancel} className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition">取消</button>
                    <button type="submit" className="px-10 py-3 text-white bg-slate-900 hover:bg-slate-800 rounded-xl font-bold shadow-lg shadow-slate-200 transition transform active:scale-95">保存资产</button>
                </div>
           </form>
        </div>
    );
};

export default InvestmentForm;
