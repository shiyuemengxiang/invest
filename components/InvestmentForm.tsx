
import React, { useState, useEffect } from 'react';
import { Currency, Investment, InvestmentCategory, InvestmentType, CATEGORY_LABELS, Transaction } from '../types';
import { ToastType } from './Toast';
import { recalculateInvestmentState, formatDateTime } from '../utils';

interface Props {
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  initialData?: Investment | null;
  onNotify: (msg: string, type: ToastType) => void;
}

const InvestmentForm: React.FC<Props> = ({ onSave, onCancel, initialData, onNotify }) => {
  const parseInitialSymbol = () => {
      if (!initialData?.symbol) return { code: '', market: 'sh' };
      const s = initialData.symbol;
      if (initialData.category === 'Stock' && initialData.currency === 'CNY') {
          if (s.startsWith('sh')) return { code: s.slice(2), market: 'sh' };
          if (s.startsWith('sz')) return { code: s.slice(2), market: 'sz' };
          if (s.startsWith('bj')) return { code: s.slice(2), market: 'bj' };
      }
      return { code: s, market: 'sh' };
  };

  const initialSym = parseInitialSymbol();

  const [formData, setFormData] = useState<Partial<Investment>>(
    initialData || {
      name: '',
      category: 'Fixed',
      type: 'Fixed',
      currency: 'CNY',
      depositDate: new Date().toISOString().split('T')[0],
      maturityDate: '',
      principal: 10000,
      quantity: undefined,
      symbol: '',
      isAutoQuote: false,
      expectedRate: undefined,
      currentReturn: undefined,
      realizedReturn: undefined,
      rebate: 0,
      isRebateReceived: false,
      withdrawalDate: null,
      notes: ''
    }
  );

  const [stockCode, setStockCode] = useState(initialSym.code);
  const [stockMarket, setStockMarket] = useState(initialSym.market);

  const [isCompleted, setIsCompleted] = useState(!!initialData?.withdrawalDate);
  const [isFloating, setIsFloating] = useState(initialData?.type === 'Floating');

  // Phase 2: Dividend Modal State
  const [showDividendForm, setShowDividendForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [dividendData, setDividendData] = useState({ date: new Date().toISOString().split('T')[0], amount: '', notes: '' });

  useEffect(() => {
    setIsCompleted(!!formData.withdrawalDate);
  }, [formData.withdrawalDate]);

  useEffect(() => {
      setIsFloating(formData.type === 'Floating');
  }, [formData.type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Phase 2: Add/Edit Dividend Logic
  const handleSaveDividend = () => {
      if (!dividendData.amount || Number(dividendData.amount) <= 0) {
          onNotify("请输入有效的派息金额", "error");
          return;
      }

      const currentTxs = formData.transactions ? [...formData.transactions] : [];

      if (editingTxId) {
          // Update existing
          const index = currentTxs.findIndex(t => t.id === editingTxId);
          if (index >= 0) {
              currentTxs[index] = {
                  ...currentTxs[index],
                  date: dividendData.date,
                  amount: Number(dividendData.amount),
                  notes: dividendData.notes || '派息/分红 (Edited)'
              };
              onNotify("交易记录已更新", "success");
          }
      } else {
          // Add new
          const newTx: Transaction = {
              id: self.crypto.randomUUID(),
              date: dividendData.date,
              type: 'Dividend',
              amount: Number(dividendData.amount),
              notes: dividendData.notes || '派息/分红 (Manual)'
          };
          currentTxs.push(newTx);
          onNotify("派息记录已添加 (保存后生效)", "success");
      }

      // Optimistic update of formData
      setFormData(prev => ({ ...prev, transactions: currentTxs }));
      
      // Reset form
      setShowDividendForm(false);
      setEditingTxId(null);
      setDividendData({ date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
  };

  const handleEditTransaction = (tx: Transaction) => {
      setDividendData({
          date: tx.date.split('T')[0], // Ensure YYYY-MM-DD for input type="date"
          amount: String(tx.amount),
          notes: tx.notes || ''
      });
      setEditingTxId(tx.id);
      setShowDividendForm(true);
  };

  const handleDeleteTransaction = (id: string) => {
      if (!window.confirm("确定要删除这条交易记录吗？")) return;
      
      const currentTxs = formData.transactions ? [...formData.transactions] : [];
      const updatedTxs = currentTxs.filter(t => t.id !== id);
      setFormData(prev => ({ ...prev, transactions: updatedTxs }));
      onNotify("交易记录已删除", "info");
      
      // If we were editing this one, close the form
      if (editingTxId === id) {
          setShowDividendForm(false);
          setEditingTxId(null);
          setDividendData({ date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
      }
  };

  const handleCancelDividend = () => {
      setShowDividendForm(false);
      setEditingTxId(null);
      setDividendData({ date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.depositDate || !formData.principal) {
      onNotify("请填写必要信息（名称、本金、存入时间）", "error");
      return;
    }
    
    if (!isFloating && !formData.maturityDate) {
        onNotify("固收型产品请填写到期时间", "error");
        return;
    }

    let finalSymbol = formData.symbol;
    if (formData.category === 'Stock' && formData.currency === 'CNY' && stockCode) {
        finalSymbol = `${stockMarket}${stockCode}`;
    } else if ((formData.category === 'Fund' || formData.category === 'Stock') && stockCode) {
        finalSymbol = stockCode;
    }

    const principal = Number(formData.principal);
    const quantity = formData.quantity && formData.quantity > 0 ? Number(formData.quantity) : undefined;

    // --- PHASE 1 REFACTOR: Construct Transactions for New Items ---
    // Note: We respect existing transactions (e.g. newly added Dividends) and just sync the Primary Buy/Sell
    
    let transactions: Transaction[] = formData.transactions ? [...formData.transactions] : (initialData?.transactions ? [...initialData.transactions] : []);
    
    if (transactions.length === 0) {
        // Create initial transaction if none exists
        transactions.push({
            id: self.crypto.randomUUID(),
            date: formData.depositDate!,
            type: 'Buy',
            amount: principal,
            quantity: quantity,
            price: quantity ? principal / quantity : undefined,
            notes: 'Initial Deposit'
        });
    } else {
        // Modify the first 'Buy' transaction (assuming it's the initial deposit)
        // We look for the "Buy" transaction that corresponds to the main principal. 
        // For simplicity in Phase 1, we assume the first "Buy" is the primary one.
        const firstBuyIndex = transactions.findIndex(t => t.type === 'Buy');
        if (firstBuyIndex >= 0) {
            transactions[firstBuyIndex] = {
                ...transactions[firstBuyIndex],
                date: formData.depositDate!,
                amount: principal,
                quantity: quantity,
                price: quantity ? principal / quantity : undefined
            };
        }
        
        // Handle Withdrawal/Sell
        // If we have a withdrawal date, we enforce a matching "Sell" transaction.
        const sellIndex = transactions.findIndex(t => t.type === 'Sell' && (t.notes === 'Full Withdrawal' || t.notes === 'Full Withdrawal (Migrated)'));
        
        if (formData.withdrawalDate) {
             if (sellIndex >= 0) {
                 transactions[sellIndex] = {
                     ...transactions[sellIndex],
                     date: formData.withdrawalDate,
                     amount: principal, // Assuming full exit
                     quantity: quantity
                 };
             } else {
                 transactions.push({
                     id: self.crypto.randomUUID(),
                     date: formData.withdrawalDate,
                     type: 'Sell',
                     amount: principal,
                     quantity: quantity,
                     notes: 'Full Withdrawal'
                 });
             }
        } else {
            // If withdrawal date removed, remove corresponding Sell tx
            if (sellIndex >= 0) {
                transactions.splice(sellIndex, 1);
            }
        }
    }

    const baseInvestment: Investment = {
      id: initialData?.id || self.crypto.randomUUID(),
      name: formData.name!,
      category: (formData.category as InvestmentCategory) || 'Fixed',
      type: (formData.type as InvestmentType) || 'Fixed',
      currency: (formData.currency as Currency) || 'CNY',
      depositDate: formData.depositDate!,
      maturityDate: formData.maturityDate || '', 
      withdrawalDate: formData.withdrawalDate || null,
      principal: principal, // Legacy support
      quantity: quantity,   // Legacy support
      symbol: finalSymbol || undefined,
      isAutoQuote: !!formData.isAutoQuote,
      expectedRate: formData.expectedRate && formData.expectedRate !== 0 ? Number(formData.expectedRate) : undefined,
      currentReturn: formData.currentReturn ? Number(formData.currentReturn) : undefined,
      realizedReturn: formData.realizedReturn ? Number(formData.realizedReturn) : undefined,
      rebate: Number(formData.rebate || 0),
      isRebateReceived: !!formData.isRebateReceived,
      notes: formData.notes || '',
      
      // New Fields
      transactions: transactions,
      currentPrincipal: 0, // Will be computed
      currentQuantity: 0, // Will be computed
      totalCost: 0, // Will be computed
      totalRealizedProfit: 0 // Will be computed
    };
    
    // Apply calculation before saving
    const finalizedInvestment = recalculateInvestmentState(baseInvestment);
    
    onSave(finalizedInvestment);
  };

  const isFundOrStock = formData.category === 'Fund' || formData.category === 'Stock';
  const isCNYStock = formData.category === 'Stock' && formData.currency === 'CNY';

  // Helper to translate tx type
  const getTxTypeLabel = (type: string) => {
      switch(type) {
          case 'Buy': return '买入/存入';
          case 'Sell': return '卖出/取出';
          case 'Dividend': return '派息/分红';
          default: return type;
      }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl shadow-slate-200/50 max-w-2xl mx-auto border border-white/50 animate-fade-in-up">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{initialData ? '编辑资产' : '录入新资产'}</h2>
        <span className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg font-medium shadow-sm">Smart Ledger</span>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-4 p-1 bg-slate-100 rounded-xl mb-4">
            <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'Fixed'})}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isFloating ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                固收型 (Fixed)
            </button>
            <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'Floating'})}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isFloating ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                浮动型 (Floating)
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-slate-700 mb-2">资产名称</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition duration-200" placeholder="例如: 某宝30天新人专享 / 腾讯控股" required />
            </div>
             <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">分类标签</label>
                 <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition duration-200">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                 </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2">币种</label>
             <select name="currency" value={formData.currency} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition duration-200">
                <option value="CNY">CNY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="HKD">HKD (HK$)</option>
             </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">投入本金</label>
            <div className="relative">
                <input type="number" name="principal" value={formData.principal} onChange={handleChange} className="w-full p-3 pl-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{isFloating ? '预计年化 (%)' : '预计年化 (%)'} <span className="text-slate-400 font-normal text-xs ml-1">{isFloating ? '(可选)' : '(必填)'}</span></label>
            <input type="number" step="0.01" name="expectedRate" value={formData.expectedRate === undefined ? '' : formData.expectedRate} onChange={handleChange} placeholder={isFloating ? "浮动可不填" : "4.00"} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg`} required={!isFloating} />
          </div>
        </div>
        
        {isFundOrStock && (
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">持有份额/股数 (Quantity)</label>
                        <input type="number" step="0.0001" name="quantity" value={formData.quantity === undefined ? '' : formData.quantity} onChange={handleChange} placeholder="0" className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{isCNYStock ? '股票代码 (Code)' : '交易代码 (Symbol)'}</label>
                        <input type="text" value={isCNYStock ? stockCode : (formData.symbol || '')} onChange={(e) => { if (isCNYStock) setStockCode(e.target.value); else setFormData(prev => ({ ...prev, symbol: e.target.value })); }} placeholder={isCNYStock ? "如: 600519" : "如: AAPL, 0700.HK"} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono uppercase" />
                    </div>
                </div>
                {isCNYStock && (
                    <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-sm font-bold text-slate-600 px-2">A股市场:</span>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="market" value="sh" checked={stockMarket === 'sh'} onChange={() => setStockMarket('sh')} className="text-indigo-600 focus:ring-indigo-500"/><span className="text-sm text-slate-700">上证 (SH)</span></label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2"><input type="radio" name="market" value="sz" checked={stockMarket === 'sz'} onChange={() => setStockMarket('sz')} className="text-indigo-600 focus:ring-indigo-500"/><span className="text-sm text-slate-700">深证 (SZ)</span></label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2"><input type="radio" name="market" value="bj" checked={stockMarket === 'bj'} onChange={() => setStockMarket('bj')} className="text-indigo-600 focus:ring-indigo-500"/><span className="text-sm text-slate-700">北证 (BJ)</span></label>
                    </div>
                )}
                <label className="flex items-center cursor-pointer select-none group pt-2">
                    <input type="checkbox" name="isAutoQuote" checked={!!formData.isAutoQuote} onChange={handleChange} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 transition-colors duration-200"></div>
                    <span className="ml-2 text-sm text-slate-600">开启自动行情更新 (Yahoo/EastMoney)</span>
                </label>
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">买入/存入时间</label>
            <input type="date" name="depositDate" value={formData.depositDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">到期/目标时间 <span className="text-slate-400 font-normal text-xs ml-1">{isFloating ? '(可选)' : '(必填)'}</span></label>
            <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleChange} className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none ${!isFloating && !formData.maturityDate ? 'border-red-300' : ''}`} required={!isFloating} />
          </div>
           <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">卖出/取出时间 <span className="text-slate-400 text-xs">(完结时填)</span></label>
            <input type="date" name="withdrawalDate" value={formData.withdrawalDate || ''} onChange={handleChange} className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition duration-200 ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`} placeholder="未取出留空" />
          </div>
        </div>
        
        {isFloating && !isCompleted && (
             <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-indigo-900 mb-2">当前持仓累计收益额 (Current Return)</label>
                        <p className="text-xs text-indigo-700/70 mb-3">{formData.isAutoQuote ? '已开启自动行情，收益额将根据最新价格自动计算更新。' : '手动填写截止目前的浮动盈亏金额，用于计算当前持仓收益率。'}</p>
                        <div className="relative">
                            <input type="number" name="currentReturn" value={formData.currentReturn !== undefined ? formData.currentReturn : ''} onChange={handleChange} disabled={formData.isAutoQuote} className={`w-full p-3 pl-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg text-indigo-900 ${formData.isAutoQuote ? 'bg-indigo-100/50 cursor-not-allowed' : 'bg-white'}`} placeholder="0.00" />
                            <span className="absolute right-4 top-3.5 text-indigo-600/50 text-sm font-medium">{formData.currency}</span>
                        </div>
                    </div>
                 </div>
            </div>
        )}

        {isCompleted && (
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-emerald-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-emerald-900 mb-2">实际落袋收益 (不含本金)</label>
                        <p className="text-xs text-emerald-700/70 mb-3">填写后将根据 持有时长 (取出 - 存入) 和 收益 自动计算实际年化收益率。</p>
                        <div className="relative">
                            <input type="number" name="realizedReturn" value={formData.realizedReturn !== undefined ? formData.realizedReturn : ''} onChange={handleChange} className="w-full p-3 pl-4 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-lg text-emerald-900" placeholder="0.00" />
                            <span className="absolute right-4 top-3.5 text-emerald-600/50 text-sm font-medium">{formData.currency}</span>
                        </div>
                    </div>
                 </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-dashed border-slate-200">
           <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">返利/红包金额</label>
            <input type="number" name="rebate" value={formData.rebate} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition" />
          </div>
          <div className="flex items-center pt-8">
             <label className="flex items-center cursor-pointer select-none group">
                <input type="checkbox" name="isRebateReceived" checked={!!formData.isRebateReceived} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 transition-colors duration-200"></div>
                <span className="ml-3 text-sm font-medium text-slate-600 group-hover:text-slate-800 transition">返利已到账</span>
            </label>
          </div>
        </div>

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">备注</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none h-24 resize-none transition" />
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition font-medium">取消</button>
          <button type="submit" className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-300 transition transform active:scale-95 font-medium">保存记录</button>
        </div>
      </form>

      {/* --- Phase 2: Transaction History & Operations --- */}
      <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    交易流水 (Transaction History)
                </h3>
                {initialData && !isCompleted && !showDividendForm && (
                    <button 
                        type="button" 
                        onClick={() => {
                            setDividendData({ date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
                            setEditingTxId(null);
                            setShowDividendForm(true);
                        }}
                        className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold transition flex items-center gap-1"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        记录派息/分红
                    </button>
                )}
            </div>

            {/* Dividend Form Modal/Inline */}
            {showDividendForm && (
                <div className="mb-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-fade-in">
                    <h4 className="text-sm font-bold text-indigo-900 mb-3">{editingTxId ? '编辑派息记录 (Edit Dividend)' : '新增派息记录 (Add Dividend)'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <input type="date" value={dividendData.date} onChange={e => setDividendData({...dividendData, date: e.target.value})} className="p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                        <input type="number" placeholder="金额 (Amount)" value={dividendData.amount} onChange={e => setDividendData({...dividendData, amount: e.target.value})} className="p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                        <input type="text" placeholder="备注 (选填)" value={dividendData.notes} onChange={e => setDividendData({...dividendData, notes: e.target.value})} className="p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={handleCancelDividend} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">取消</button>
                        <button type="button" onClick={handleSaveDividend} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm">{editingTxId ? '确认修改' : '确认添加'}</button>
                    </div>
                </div>
            )}

            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="p-3">日期 (Date)</th>
                            <th className="p-3">类型 (Type)</th>
                            <th className="p-3 text-right">金额 (Amount)</th>
                            <th className="p-3">备注 (Notes)</th>
                            <th className="p-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(formData.transactions && formData.transactions.length > 0 ? formData.transactions : (initialData?.transactions || [])).map(tx => (
                            <tr key={tx.id} className="text-slate-700 hover:bg-white transition group">
                                <td className="p-3 font-mono text-slate-500">{formatDateTime(tx.date)}</td>
                                <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded border font-medium text-[10px] ${
                                        tx.type === 'Buy' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                        tx.type === 'Sell' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                        tx.type === 'Dividend' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                        {getTxTypeLabel(tx.type)}
                                    </span>
                                </td>
                                <td className="p-3 text-right font-mono font-medium">
                                    {tx.type === 'Sell' ? '-' : '+'}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-slate-400 truncate max-w-[150px]">{tx.notes || '-'}</td>
                                <td className="p-3 text-right">
                                    {tx.type === 'Dividend' && (
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                type="button" 
                                                onClick={() => handleEditTransaction(tx)}
                                                className="text-indigo-500 hover:text-indigo-700"
                                                title="编辑"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                className="text-red-400 hover:text-red-600"
                                                title="删除"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {(!formData.transactions || formData.transactions.length === 0) && (!initialData?.transactions || initialData.transactions.length === 0) && (
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-300 italic">暂无交易流水</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
      </div>
    </div>
  );
};

export default InvestmentForm;
