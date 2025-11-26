import React, { useState, useEffect } from 'react';
import { Investment, Transaction, CATEGORY_LABELS, Currency } from '../types';
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
            id: crypto.randomUUID(),
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
        amount: 0,
        frequency: 'monthly', // monthly, quarterly, yearly
        startDate: '',
        endDate: '',
        count: 12
    });

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
            id: crypto.randomUUID(),
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

            newTxs.push({
                id: crypto.randomUUID(),
                date: currentDate.toISOString().split('T')[0],
                type: 'Dividend',
                amount: Number(batchConfig.amount),
                notes: 'Batch Generated'
            });

            // Increment date
            if (batchConfig.frequency === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
            else if (batchConfig.frequency === 'quarterly') currentDate.setMonth(currentDate.getMonth() + 3);
            else if (batchConfig.frequency === 'yearly') currentDate.setFullYear(currentDate.getFullYear() + 1);
            else currentDate.setDate(currentDate.getDate() + 30); // Default approx month

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
           {/* Form Content */}
           <h2 className="text-2xl font-bold mb-6 text-slate-800">{initialData ? '编辑资产' : '新增资产'}</h2>
           
           <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">名称</label>
                        <input name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" required />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">分类</label>
                        <select name="category" value={formData.category} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200">
                             {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                 <option key={k} value={k}>{v}</option>
                             ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">类型</label>
                        <select name="type" value={formData.type} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200">
                             <option value="Fixed">固收型 (Fixed)</option>
                             <option value="Floating">浮动型 (Floating)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">币种</label>
                        <select name="currency" value={formData.currency} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200">
                             <option value="CNY">CNY</option>
                             <option value="USD">USD</option>
                             <option value="HKD">HKD</option>
                        </select>
                    </div>
                </div>

                {/* Dates & Rates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">开始日期 (Deposit)</label>
                        <input type="date" name="depositDate" value={formData.depositDate} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" required />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">到期日期 (Maturity)</label>
                        <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">已完结日期 (Withdrawal)</label>
                        <input type="date" name="withdrawalDate" value={formData.withdrawalDate || ''} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" />
                     </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">预期年化 (%)</label>
                        <input type="number" step="0.01" name="expectedRate" value={formData.expectedRate || ''} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" placeholder="0.00" />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">返利金额 (Rebate)</label>
                        <input type="number" step="0.01" name="rebate" value={formData.rebate || ''} onChange={handleInputChange} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200" placeholder="0.00" />
                    </div>
                     <div className="flex items-center pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" name="isRebateReceived" checked={formData.isRebateReceived} onChange={(e) => setFormData({...formData, isRebateReceived: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-bold text-slate-700">返利已到账</span>
                        </label>
                    </div>
                </div>
                
                {/* Advanced: Symbol for Auto Quote */}
                <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">
                        行情代码 (Symbol) 
                        <span className="text-xs font-normal text-slate-400 ml-2">股票/基金代码, 如 sh600000, 000001</span>
                     </label>
                     <div className="flex gap-4">
                         <input name="symbol" value={formData.symbol || ''} onChange={handleInputChange} className="flex-1 p-2 bg-slate-50 rounded-lg border border-slate-200" placeholder="选填, 用于自动获取行情" />
                         <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                            <input type="checkbox" checked={formData.isAutoQuote || false} onChange={(e) => setFormData({...formData, isAutoQuote: e.target.checked})} className="w-5 h-5 rounded text-indigo-600" />
                            <span className="text-sm font-bold text-slate-700">开启自动更新</span>
                         </label>
                     </div>
                </div>
                
                {/* Computed Read-only Stats */}
                <div className="p-4 bg-slate-100 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-xs text-slate-500 uppercase">当前本金</p>
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(formData.currentPrincipal, formData.currency)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase">持仓数量</p>
                        <p className="text-lg font-bold text-slate-800">{formData.currentQuantity || 0}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase">累计投入</p>
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(formData.totalCost, formData.currency)}</p>
                    </div>
                     <div>
                        <p className="text-xs text-slate-500 uppercase">已实现收益</p>
                        <p className={`text-lg font-bold ${formData.totalRealizedProfit >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {formatCurrency(formData.totalRealizedProfit, formData.currency)}
                        </p>
                    </div>
                </div>

                {/* Transactions Section */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700">交易记录 (Transactions)</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowBatchForm(!showBatchForm)} className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 font-bold border border-purple-200">
                                批量生成利息
                            </button>
                            <button type="button" onClick={addTransaction} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-bold">
                                + 添加记录
                            </button>
                        </div>
                    </div>
                    
                    {/* Batch Generator UI */}
                    {showBatchForm && (
                        <div className="mb-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100 animate-fade-in">
                            <h4 className="text-sm font-bold text-purple-800 mb-3">批量生成派息记录 (Batch Generate Dividends)</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="text-xs text-purple-700 block mb-1">单次金额</label>
                                    <input type="number" value={batchConfig.amount} onChange={e => setBatchConfig({...batchConfig, amount: parseFloat(e.target.value)})} className="w-full p-1.5 text-xs border border-purple-200 rounded" />
                                </div>
                                <div>
                                    <label className="text-xs text-purple-700 block mb-1">频率</label>
                                    <select value={batchConfig.frequency} onChange={e => setBatchConfig({...batchConfig, frequency: e.target.value})} className="w-full p-1.5 text-xs border border-purple-200 rounded">
                                        <option value="monthly">每月</option>
                                        <option value="quarterly">每季</option>
                                        <option value="yearly">每年</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-purple-700 block mb-1">开始日期</label>
                                    <input type="date" value={batchConfig.startDate} onChange={e => setBatchConfig({...batchConfig, startDate: e.target.value})} className="w-full p-1.5 text-xs border border-purple-200 rounded" />
                                </div>
                                <div>
                                    <label className="text-xs text-purple-700 block mb-1">数量 (期)</label>
                                    <input type="number" value={batchConfig.count} onChange={e => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className="w-full p-1.5 text-xs border border-purple-200 rounded" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-purple-100 pt-3">
                                <button 
                                    type="button" 
                                    onClick={handleClearFutureDividends}
                                    className="text-xs text-red-400 hover:text-red-600 underline decoration-red-200 underline-offset-2"
                                >
                                    清除未来已生成的记录
                                </button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowBatchForm(false)} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">取消</button>
                                    <button type="button" onClick={handleSaveBatch} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm">立即生成</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {formData.transactions?.map((tx, index) => (
                            <div key={tx.id || index} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <select 
                                    value={tx.type} 
                                    onChange={(e) => handleTransactionChange(index, 'type', e.target.value)}
                                    className="text-xs p-1.5 rounded border border-slate-200 w-24 bg-white"
                                >
                                    <option value="Buy">买入/存入</option>
                                    <option value="Sell">卖出/赎回</option>
                                    <option value="Dividend">派息/分红</option>
                                    <option value="Interest">利息</option>
                                    <option value="Fee">手续费</option>
                                </select>
                                <input 
                                    type="date" 
                                    value={tx.date.split('T')[0]} 
                                    onChange={(e) => handleTransactionChange(index, 'date', e.target.value)}
                                    className="text-xs p-1.5 rounded border border-slate-200 w-32 bg-white"
                                />
                                <input 
                                    type="number" 
                                    placeholder="金额 Amount"
                                    value={tx.amount || ''} 
                                    onChange={(e) => handleTransactionChange(index, 'amount', parseFloat(e.target.value))}
                                    className="text-xs p-1.5 rounded border border-slate-200 w-24 bg-white flex-1"
                                />
                                <input 
                                    type="number" 
                                    placeholder="份额 Qty"
                                    value={tx.quantity || ''} 
                                    onChange={(e) => handleTransactionChange(index, 'quantity', parseFloat(e.target.value))}
                                    className="text-xs p-1.5 rounded border border-slate-200 w-20 bg-white"
                                />
                                <input 
                                    type="text" 
                                    placeholder="备注 Notes"
                                    value={tx.notes || ''} 
                                    onChange={(e) => handleTransactionChange(index, 'notes', e.target.value)}
                                    className="text-xs p-1.5 rounded border border-slate-200 w-full md:w-auto flex-1 bg-white"
                                />
                                <button type="button" onClick={() => removeTransaction(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {(!formData.transactions || formData.transactions.length === 0) && (
                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                暂无交易记录，请添加初始"买入"记录以计算本金
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-4 justify-end">
                    <button type="button" onClick={onCancel} className="px-6 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition">取消</button>
                    <button type="submit" className="px-8 py-2.5 text-white bg-slate-900 hover:bg-slate-800 rounded-xl font-bold shadow-lg transition transform active:scale-95">保存</button>
                </div>
           </form>
        </div>
    );
};

export default InvestmentForm;