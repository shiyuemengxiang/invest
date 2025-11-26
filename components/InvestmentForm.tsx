
import React, { useState, useEffect } from 'react';
import { Currency, Investment, InvestmentCategory, InvestmentType, CATEGORY_LABELS, Transaction, TransactionType } from '../types';
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

  // --- Phase 3: Transaction Modal State ---
  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txData, setTxData] = useState<{
      type: TransactionType;
      date: string;
      amount: string;
      price: string;
      quantity: string;
      notes: string;
      // New fields for merging terms on "Buy"
      newMaturityDate: string;
      newExpectedRate: string;
  }>({ 
      type: 'Buy', 
      date: new Date().toISOString().split('T')[0], 
      amount: '', 
      price: '', 
      quantity: '', 
      notes: '',
      newMaturityDate: '',
      newExpectedRate: ''
  });

  useEffect(() => {
    setIsCompleted(!!formData.withdrawalDate);
  }, [formData.withdrawalDate]);

  useEffect(() => {
      setIsFloating(formData.type === 'Floating');
  }, [formData.type]);

  // Auto-calc amount/quantity logic for Tx Form
  useEffect(() => {
      if (isFloating && txData.price && txData.quantity && (document.activeElement as HTMLInputElement)?.name !== 'amount') {
          const amt = (parseFloat(txData.price) * parseFloat(txData.quantity)).toFixed(2);
          setTxData(prev => ({...prev, amount: amt}));
      }
  }, [txData.price, txData.quantity, isFloating]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // --- Transaction Operations ---

  const openTxForm = (type: TransactionType) => {
      setTxData({
          type,
          date: new Date().toISOString().split('T')[0],
          amount: '',
          price: '',
          quantity: '',
          notes: '',
          newMaturityDate: formData.maturityDate || '',
          newExpectedRate: formData.expectedRate ? String(formData.expectedRate) : ''
      });
      setEditingTxId(null);
      setShowTxForm(true);
  };

  const handleSaveTx = () => {
      if (!txData.amount || Number(txData.amount) <= 0) {
          onNotify("请输入有效的金额", "error");
          return;
      }

      // 1. Prepare Transaction List
      // Fix logic: Always fallback to initialData if formData.transactions is undefined/empty to avoid wiping history
      const currentTxs = formData.transactions && formData.transactions.length > 0
          ? [...formData.transactions] 
          : (initialData?.transactions ? [...initialData.transactions] : []);

      const newTx: Transaction = {
          id: editingTxId || self.crypto.randomUUID(),
          date: txData.date,
          type: txData.type,
          amount: Number(txData.amount),
          price: txData.price ? Number(txData.price) : undefined,
          quantity: txData.quantity ? Number(txData.quantity) : undefined,
          notes: txData.notes
      };

      if (editingTxId) {
          const index = currentTxs.findIndex(t => t.id === editingTxId);
          if (index >= 0) currentTxs[index] = newTx;
      } else {
          currentTxs.push(newTx);
      }

      // 2. Apply Updates to Parent State
      const updatedFormData = { ...formData, transactions: currentTxs };

      // If it's a Fixed Income 'Buy' (Add Principal), allow updating Maturity/Rate
      if (!isFloating && txData.type === 'Buy') {
          if (txData.newMaturityDate) updatedFormData.maturityDate = txData.newMaturityDate;
          if (txData.newExpectedRate) updatedFormData.expectedRate = Number(txData.newExpectedRate);
      }

      setFormData(updatedFormData);
      
      setShowTxForm(false);
      setEditingTxId(null);
      onNotify(editingTxId ? "交易记录已更新" : "交易记录已添加", "success");
  };

  const handleEditTransaction = (tx: Transaction) => {
      setTxData({
          type: tx.type,
          date: tx.date.split('T')[0],
          amount: String(tx.amount),
          price: tx.price ? String(tx.price) : '',
          quantity: tx.quantity ? String(tx.quantity) : '',
          notes: tx.notes || '',
          newMaturityDate: formData.maturityDate || '',
          newExpectedRate: formData.expectedRate ? String(formData.expectedRate) : ''
      });
      setEditingTxId(tx.id);
      setShowTxForm(true);
  };

  const handleDeleteTransaction = (id: string) => {
      if (!window.confirm("确定要删除这条交易记录吗？")) return;
      
      const currentTxs = formData.transactions && formData.transactions.length > 0
          ? [...formData.transactions] 
          : (initialData?.transactions ? [...initialData.transactions] : []);

      const updatedTxs = currentTxs.filter(t => t.id !== id);
      setFormData(prev => ({ ...prev, transactions: updatedTxs }));
      onNotify("交易记录已删除", "info");
      
      if (editingTxId === id) {
          setShowTxForm(false);
          setEditingTxId(null);
      }
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

    // Logic to ensure initial transaction exists if this is a new item
    let transactions: Transaction[] = formData.transactions && formData.transactions.length > 0
        ? [...formData.transactions] 
        : (initialData?.transactions ? [...initialData.transactions] : []);
    
    if (transactions.length === 0) {
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
        // Sync first Buy if needed (only if it's the initial one)
        const firstBuyIndex = transactions.findIndex(t => t.type === 'Buy');
        if (firstBuyIndex >= 0) {
             // Only update if it looks like the initial one (simple heuristic)
             if (transactions[firstBuyIndex].notes === 'Initial Deposit' || transactions[firstBuyIndex].notes === 'Initial Deposit (Migrated)') {
                 transactions[firstBuyIndex] = {
                    ...transactions[firstBuyIndex],
                    date: formData.depositDate!,
                    amount: principal,
                    quantity: quantity,
                    price: quantity ? principal / quantity : undefined
                 };
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
      principal: principal, 
      quantity: quantity,   
      symbol: finalSymbol || undefined,
      isAutoQuote: !!formData.isAutoQuote,
      expectedRate: formData.expectedRate && formData.expectedRate !== 0 ? Number(formData.expectedRate) : undefined,
      currentReturn: formData.currentReturn ? Number(formData.currentReturn) : undefined,
      realizedReturn: formData.realizedReturn ? Number(formData.realizedReturn) : undefined,
      rebate: Number(formData.rebate || 0),
      isRebateReceived: !!formData.isRebateReceived,
      notes: formData.notes || '',
      
      transactions: transactions,
      currentPrincipal: 0, 
      currentQuantity: 0, 
      totalCost: 0, 
      totalRealizedProfit: 0 
    };
    
    const finalizedInvestment = recalculateInvestmentState(baseInvestment);
    onSave(finalizedInvestment);
  };

  const isFundOrStock = formData.category === 'Fund' || formData.category === 'Stock';
  const isCNYStock = formData.category === 'Stock' && formData.currency === 'CNY';

  const getTxTypeLabel = (type: string) => {
      switch(type) {
          case 'Buy': return isFloating ? '加仓/买入' : '存入/追加';
          case 'Sell': return isFloating ? '减仓/卖出' : '提取/赎回';
          case 'Dividend': return '派息/分红';
          default: return type;
      }
  };

  const displayTransactions = formData.transactions && formData.transactions.length > 0 
      ? formData.transactions 
      : (initialData?.transactions || []);

  return (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl shadow-slate-200/50 max-w-2xl mx-auto border border-white/50 animate-fade-in-up">
      {/* Header & Form Fields */}
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
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none" placeholder="例如: 某宝30天新人专享 / 腾讯控股" required />
            </div>
             <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">分类标签</label>
                 <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                 </select>
            </div>
        </div>

        {/* Principal & Rates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2">币种</label>
             <select name="currency" value={formData.currency} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none">
                <option value="CNY">CNY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="HKD">HKD (HK$)</option>
             </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">初始/当前本金</label>
            <input type="number" name="principal" value={formData.principal} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{isFloating ? '预计年化 (%)' : '预计年化 (%)'} <span className="text-slate-400 text-xs">{isFloating ? '(可选)' : '(必填)'}</span></label>
            <input type="number" step="0.01" name="expectedRate" value={formData.expectedRate === undefined ? '' : formData.expectedRate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg" required={!isFloating} />
          </div>
        </div>
        
        {/* Stock/Fund Details */}
        {isFundOrStock && (
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">持有份额 (Quantity)</label>
                        <input type="number" step="0.0001" name="quantity" value={formData.quantity === undefined ? '' : formData.quantity} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{isCNYStock ? '股票代码 (Code)' : '交易代码 (Symbol)'}</label>
                        <input type="text" value={isCNYStock ? stockCode : (formData.symbol || '')} onChange={(e) => { if (isCNYStock) setStockCode(e.target.value); else setFormData(prev => ({ ...prev, symbol: e.target.value })); }} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono uppercase" />
                    </div>
                </div>
                {isCNYStock && (
                    <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-sm font-bold text-slate-600 px-2">A股市场:</span>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="market" value="sh" checked={stockMarket === 'sh'} onChange={() => setStockMarket('sh')} className="text-indigo-600"/><span className="text-sm text-slate-700">上证 (SH)</span></label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2"><input type="radio" name="market" value="sz" checked={stockMarket === 'sz'} onChange={() => setStockMarket('sz')} className="text-indigo-600"/><span className="text-sm text-slate-700">深证 (SZ)</span></label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2"><input type="radio" name="market" value="bj" checked={stockMarket === 'bj'} onChange={() => setStockMarket('bj')} className="text-indigo-600"/><span className="text-sm text-slate-700">北证 (BJ)</span></label>
                    </div>
                )}
                <label className="flex items-center cursor-pointer select-none group pt-2">
                    <input type="checkbox" name="isAutoQuote" checked={!!formData.isAutoQuote} onChange={handleChange} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                    <span className="ml-2 text-sm text-slate-600">开启自动行情更新</span>
                </label>
             </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">买入/存入时间</label>
            <input type="date" name="depositDate" value={formData.depositDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">到期/目标时间</label>
            <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none" required={!isFloating} />
          </div>
           <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">卖出/取出时间</label>
            <input type="date" name="withdrawalDate" value={formData.withdrawalDate || ''} onChange={handleChange} className={`w-full p-3 border rounded-xl focus:ring-2 outline-none transition ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`} />
          </div>
        </div>
        
        {isFloating && !isCompleted && (
             <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-indigo-900 mb-2">当前持仓累计收益额 (Current Return)</label>
                        <div className="relative">
                            <input type="number" name="currentReturn" value={formData.currentReturn !== undefined ? formData.currentReturn : ''} onChange={handleChange} disabled={formData.isAutoQuote} className={`w-full p-3 pl-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg text-indigo-900 ${formData.isAutoQuote ? 'bg-indigo-100/50 cursor-not-allowed' : 'bg-white'}`} placeholder="0.00" />
                            <span className="absolute right-4 top-3.5 text-indigo-600/50 text-sm font-medium">{formData.currency}</span>
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
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 transition-colors"></div>
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

      {/* --- Phase 3: Advanced Transaction History & Operations --- */}
      <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    交易流水 (Transaction History)
                </h3>
                
                {/* Operation Buttons */}
                {initialData && !isCompleted && !showTxForm && (
                    <div className="flex gap-2">
                        {isFloating ? (
                            <>
                                <button onClick={() => openTxForm('Buy')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    加仓 (Buy)
                                </button>
                                <button onClick={() => openTxForm('Sell')} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                    减仓 (Sell)
                                </button>
                                <button onClick={() => openTxForm('Dividend')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    分红 (Div)
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => openTxForm('Buy')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    追加本金
                                </button>
                                <button onClick={() => openTxForm('Sell')} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                    提取本金
                                </button>
                                <button onClick={() => openTxForm('Dividend')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold transition flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    记录利息
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Transaction Modal */}
            {showTxForm && (
                <div className="mb-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-fade-in">
                    <h4 className="text-sm font-bold text-indigo-900 mb-3">
                        {editingTxId ? '编辑交易' : `新增: ${getTxTypeLabel(txData.type)}`}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">日期</label>
                            <input type="date" value={txData.date} onChange={e => setTxData({...txData, date: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        
                        {/* Price/Qty only for Floating Buy/Sell */}
                        {isFloating && txData.type !== 'Dividend' && (
                            <>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-indigo-400 mb-1">单价 (Price)</label>
                                    <input type="number" step="0.0001" name="price" value={txData.price} onChange={e => setTxData({...txData, price: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-indigo-400 mb-1">数量 (Qty)</label>
                                    <input type="number" step="0.0001" name="quantity" value={txData.quantity} onChange={e => setTxData({...txData, quantity: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0" />
                                </div>
                            </>
                        )}

                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">总金额 (Total)</label>
                            <input type="number" step="0.01" name="amount" value={txData.amount} onChange={e => setTxData({...txData, amount: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300 font-bold" placeholder="0.00" />
                        </div>
                        
                        {/* Term Updates for Fixed Buy */}
                        {!isFloating && txData.type === 'Buy' && (
                            <>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-orange-500 mb-1">更新到期时间</label>
                                    <input type="date" value={txData.newMaturityDate} onChange={e => setTxData({...txData, newMaturityDate: e.target.value})} className="w-full p-2 border border-orange-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-300" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-orange-500 mb-1">更新综合利率(%)</label>
                                    <input type="number" step="0.01" value={txData.newExpectedRate} onChange={e => setTxData({...txData, newExpectedRate: e.target.value})} className="w-full p-2 border border-orange-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-300" placeholder="可选" />
                                </div>
                            </>
                        )}

                        <div className="col-span-1 sm:col-span-2 md:col-span-4">
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">备注</label>
                            <input type="text" value={txData.notes} onChange={e => setTxData({...txData, notes: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" placeholder="可选备注" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-indigo-100 pt-3">
                        <button type="button" onClick={() => { setShowTxForm(false); setEditingTxId(null); }} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">取消</button>
                        <button type="button" onClick={handleSaveTx} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm">{editingTxId ? '确认修改' : '确认提交'}</button>
                    </div>
                </div>
            )}

            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="p-3">日期 (Date)</th>
                            <th className="p-3">类型</th>
                            <th className="p-3 text-right">金额 (Amount)</th>
                            {isFloating && <th className="p-3 text-right">单价/数量</th>}
                            <th className="p-3">备注</th>
                            <th className="p-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayTransactions.map(tx => (
                            <tr key={tx.id} className="text-slate-700 hover:bg-white transition group">
                                <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(tx.date)}</td>
                                <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded border font-medium text-[10px] whitespace-nowrap ${
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
                                {isFloating && (
                                    <td className="p-3 text-right font-mono text-slate-500">
                                        {tx.price && tx.quantity ? `${tx.price} x ${tx.quantity}` : '-'}
                                    </td>
                                )}
                                <td className="p-3 text-slate-400 truncate max-w-[100px]">{tx.notes || '-'}</td>
                                <td className="p-3 text-right">
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
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
      </div>
    </div>
  );
};

export default InvestmentForm;
