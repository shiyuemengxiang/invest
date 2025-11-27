
import React, { useState, useEffect } from 'react';
import { Currency, Investment, InvestmentCategory, InvestmentType, CATEGORY_LABELS, Transaction, TransactionType } from '../types';
import { ToastType } from './Toast';
import { recalculateInvestmentState, formatDateTime, formatCurrency } from '../utils';

interface Props {
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  initialData?: Investment | null;
  onNotify: (msg: string, type: ToastType) => void;
}

// Helper for datetime-local input
const getCurrentLocalISO = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

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

  // Initialize state with robust default for transactions
  const [formData, setFormData] = useState<Partial<Investment>>(() => {
      const base = initialData ? { ...initialData } : {
        name: '',
        category: 'Fixed' as InvestmentCategory,
        type: 'Fixed' as InvestmentType,
        currency: 'CNY' as Currency,
        depositDate: new Date().toISOString().split('T')[0],
        maturityDate: '',
        principal: 10000,
        quantity: undefined,
        symbol: '',
        isAutoQuote: false,
        expectedRate: undefined,
        interestBasis: '365' as '365' | '360',
        currentReturn: undefined,
        realizedReturn: undefined,
        rebate: 0,
        isRebateReceived: false,
        withdrawalDate: null,
        notes: '',
        transactions: [] as Transaction[]
      };
      
      if (!base.transactions) base.transactions = [];
      return base;
  });

  const [stockCode, setStockCode] = useState(initialSym.code);
  const [stockMarket, setStockMarket] = useState(initialSym.market);

  const [isCompleted, setIsCompleted] = useState(!!initialData?.withdrawalDate);
  const [isFloating, setIsFloating] = useState(initialData?.type === 'Floating');

  const [showTxForm, setShowTxForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  
  const [txData, setTxData] = useState<{
      type: TransactionType;
      date: string;
      amount: string;
      price: string;
      quantity: string;
      notes: string;
      newMaturityDate: string;
      newExpectedRate: string;
  }>({ 
      type: 'Buy', 
      date: getCurrentLocalISO(), 
      amount: '', 
      price: '', 
      quantity: '', 
      notes: '',
      newMaturityDate: '',
      newExpectedRate: ''
  });

  // Batch Generator State
  const [batchData, setBatchData] = useState({
      startDate: '',
      frequency: 'Monthly', 
      calcMode: 'rate', // fixed, rate, percent
      amount: '', // For fixed amount or percentage value
      endDate: '',
      txType: 'Dividend' as TransactionType,
      notes: '自动派息'
  });

  useEffect(() => {
    setIsCompleted(!!formData.withdrawalDate);
  }, [formData.withdrawalDate]);

  useEffect(() => {
      setIsFloating(formData.type === 'Floating');
  }, [formData.type]);

  // Update default start date when frequency changes
  useEffect(() => {
      if (showBatchForm && formData.depositDate) {
          const d = new Date(formData.depositDate);
          switch (batchData.frequency) {
              case 'Weekly': d.setDate(d.getDate() + 7); break;
              case 'Monthly': d.setMonth(d.getMonth() + 1); break;
              case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
              case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
          }
          setBatchData(prev => ({...prev, startDate: d.toISOString().split('T')[0]}));
      }
  }, [batchData.frequency, formData.depositDate, showBatchForm]);

  // Auto-calc amount/quantity logic for Tx Form
  useEffect(() => {
      if (isFloating && txData.price && txData.quantity && (document.activeElement as HTMLInputElement)?.name !== 'amount') {
          const amt = (parseFloat(txData.price) * parseFloat(txData.quantity)).toFixed(2);
          setTxData(prev => ({...prev, amount: amt}));
      }
  }, [txData.price, txData.quantity, isFloating]);

  const updateFormStateWithNewTxs = (newTxs: Transaction[]) => {
      const tempItem = { ...formData, transactions: newTxs } as Investment;
      const newState = recalculateInvestmentState(tempItem);
      
      setFormData(prev => ({
          ...prev,
          transactions: newTxs,
          currentPrincipal: newState.currentPrincipal,
          currentQuantity: newState.currentQuantity,
          principal: newState.currentPrincipal,
          withdrawalDate: (newState.currentPrincipal > 0 && prev.withdrawalDate) ? null : prev.withdrawalDate
      }));
  };

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
          date: getCurrentLocalISO(),
          amount: '',
          price: '',
          quantity: '',
          notes: '',
          newMaturityDate: formData.maturityDate || '',
          newExpectedRate: formData.expectedRate ? String(formData.expectedRate) : ''
      });
      setEditingTxId(null);
      setShowTxForm(true);
      setShowBatchForm(false);
  };

  const openBatchForm = () => {
      // Initial Open: trigger the useEffect to set start date
      setBatchData({
          startDate: '', // Will be set by effect
          frequency: 'Monthly',
          calcMode: formData.expectedRate ? 'rate' : 'fixed',
          amount: '',
          endDate: formData.maturityDate || '', 
          txType: 'Dividend',
          notes: '自动派息'
      });
      setShowBatchForm(true);
      setShowTxForm(false);
  };

  const calculateBatchAmount = () => {
      const principal = Number(formData.principal) || 0;
      
      if (batchData.calcMode === 'fixed') return Number(batchData.amount) || 0;
      
      if (batchData.calcMode === 'percent') {
          const pct = Number(batchData.amount) || 0;
          return principal * (pct / 100);
      }
      
      // Rate mode
      const rate = Number(formData.expectedRate) || 0;
      const basis = Number(formData.interestBasis) || 365;
      
      if (principal <= 0 || rate <= 0) return 0;

      switch (batchData.frequency) {
          case 'Weekly':
              return (principal * (rate / 100) / basis * 7);
          case 'Monthly':
              return (principal * (rate / 100) / 12);
          case 'Quarterly':
              return (principal * (rate / 100) / 4);
          case 'Yearly':
              return (principal * (rate / 100));
          default:
              return 0;
      }
  };

  const handleSaveBatch = () => {
      if (!batchData.startDate || !batchData.endDate) {
          onNotify("请填写开始和结束日期", "error");
          return;
      }

      const amountPerPeriod = calculateBatchAmount();
      if (amountPerPeriod <= 0) {
          onNotify("计算出的每期金额无效，请检查本金/利率或输入固定金额", "error");
          return;
      }

      const currentTxs = [...(formData.transactions || [])];

      const start = new Date(batchData.startDate);
      const end = new Date(batchData.endDate);
      end.setHours(23,59,59,999);

      let current = new Date(start);
      let count = 0;

      while (current <= end && count < 500) {
          const dateStr = current.toISOString().split('T')[0];
          currentTxs.push({
              id: self.crypto.randomUUID(),
              date: dateStr + 'T08:00',
              type: batchData.txType,
              amount: Number(amountPerPeriod.toFixed(2)),
              notes: batchData.notes + ` (${dateStr})`
          });
          count++;

          if (batchData.frequency === 'Weekly') current.setDate(current.getDate() + 7);
          else if (batchData.frequency === 'Monthly') current.setMonth(current.getMonth() + 1);
          else if (batchData.frequency === 'Quarterly') current.setMonth(current.getMonth() + 3);
          else if (batchData.frequency === 'Yearly') current.setFullYear(current.getFullYear() + 1);
          else break;
      }

      updateFormStateWithNewTxs(currentTxs);
      setShowBatchForm(false);
      onNotify(`已批量生成 ${count} 条记录`, "success");
  };
  
  const handleClearFutureDividends = () => {
      if (!window.confirm("确定要清除所有日期在今天之后的自动生成记录吗？")) return;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const currentTxs = [...(formData.transactions || [])];
          
      const updatedTxs = currentTxs.filter(tx => {
          const isAutoType = tx.type === 'Dividend' || tx.type === 'Interest' || tx.type === 'Fee' || tx.type === 'Tax';
          const isFuture = tx.date.split('T')[0] > todayStr;
          return !(isAutoType && isFuture);
      });
      
      updateFormStateWithNewTxs(updatedTxs);
      onNotify("已清除未来预估记录", "info");
  };

  const handleSaveTx = () => {
      if (!txData.amount || Number(txData.amount) <= 0) {
          onNotify("请输入有效的金额", "error");
          return;
      }

      const currentTxs = [...(formData.transactions || [])];

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

      updateFormStateWithNewTxs(currentTxs);

      if (!isFloating && txData.type === 'Buy') {
          if (txData.newMaturityDate) setFormData(prev => ({ ...prev, maturityDate: txData.newMaturityDate }));
          if (txData.newExpectedRate) setFormData(prev => ({ ...prev, expectedRate: Number(txData.newExpectedRate) }));
      }

      setShowTxForm(false);
      setEditingTxId(null);
      onNotify(editingTxId ? "交易记录已更新" : "交易记录已添加", "success");
  };

  const handleEditTransaction = (tx: Transaction) => {
      let dateVal = tx.date;
      if (tx.date.endsWith('Z') || tx.date.includes('T')) {
          const d = new Date(tx.date);
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          dateVal = d.toISOString().slice(0, 16);
      }

      setTxData({
          type: tx.type,
          date: dateVal,
          amount: String(tx.amount),
          price: tx.price ? String(tx.price) : '',
          quantity: tx.quantity ? String(tx.quantity) : '',
          notes: tx.notes || '',
          newMaturityDate: formData.maturityDate || '',
          newExpectedRate: formData.expectedRate ? String(formData.expectedRate) : ''
      });
      setEditingTxId(tx.id);
      setShowTxForm(true);
      setShowBatchForm(false);
  };

  const handleDeleteTransaction = (id: string) => {
      if (!window.confirm("确定要删除这条交易记录吗？")) return;
      
      const currentTxs = [...(formData.transactions || [])];
      const updatedTxs = currentTxs.filter(t => t.id !== id);
      
      updateFormStateWithNewTxs(updatedTxs);

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

    const inputPrincipal = Number(formData.principal);
    const inputQuantity = formData.quantity && formData.quantity > 0 ? Number(formData.quantity) : undefined;

    // Always use formData.transactions
    let transactions: Transaction[] = [...(formData.transactions || [])];
    
    const buyTransactions = transactions.filter(t => t.type === 'Buy');
    const sellTransactions = transactions.filter(t => t.type === 'Sell');
    
    if (buyTransactions.length === 0) {
        // No buys exist: create initial
        transactions.unshift({
            id: self.crypto.randomUUID(),
            date: formData.depositDate!,
            type: 'Buy',
            amount: inputPrincipal,
            quantity: inputQuantity,
            price: inputQuantity ? inputPrincipal / inputQuantity : undefined,
            notes: 'Initial Deposit'
        });
    } else if (buyTransactions.length === 1 && sellTransactions.length === 0) {
        // Simple mode (1 buy, 0 sells): Sync first buy with input
        const buyIndex = transactions.findIndex(t => t.type === 'Buy');
        if (buyIndex >= 0) {
             transactions[buyIndex] = {
                ...transactions[buyIndex],
                date: formData.depositDate!,
                amount: inputPrincipal,
                quantity: inputQuantity,
                price: inputQuantity ? inputPrincipal / inputQuantity : undefined
             };
        }
    }
    // If complex history exists, we trust transactions and don't sync from inputPrincipal

    // Sync Withdrawal logic
    if (formData.withdrawalDate) {
        const existingAutoSellIndex = transactions.findIndex(t => t.type === 'Sell' && t.notes === 'Full Withdrawal (Auto)');
        
        if (existingAutoSellIndex >= 0) {
            transactions[existingAutoSellIndex] = {
                ...transactions[existingAutoSellIndex],
                date: formData.withdrawalDate
            };
        } else {
            // Calculate hypothetical balance
            const tempItem = { 
                ...formData, 
                transactions: transactions,
                currentPrincipal: 0, currentQuantity: 0 
            } as Investment;
            const tempState = recalculateInvestmentState(tempItem);
            
            if (tempState.currentPrincipal > 0.01) {
                transactions.push({
                    id: self.crypto.randomUUID(),
                    date: formData.withdrawalDate,
                    type: 'Sell',
                    amount: tempState.currentPrincipal,
                    quantity: tempState.currentQuantity,
                    notes: 'Full Withdrawal (Auto)'
                });
            }
        }
    } else {
        const autoSellIndex = transactions.findIndex(t => t.type === 'Sell' && t.notes === 'Full Withdrawal (Auto)');
        if (autoSellIndex >= 0) {
            transactions.splice(autoSellIndex, 1);
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
      principal: inputPrincipal, 
      quantity: inputQuantity,   
      symbol: finalSymbol || undefined,
      isAutoQuote: !!formData.isAutoQuote,
      expectedRate: formData.expectedRate && formData.expectedRate !== 0 ? Number(formData.expectedRate) : undefined,
      interestBasis: formData.interestBasis as '360' | '365' || '365',
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
          case 'Interest': return '利息';
          case 'Fee': return '手续费';
          case 'Tax': return '税费';
          default: return type;
      }
  };

  const displayTransactions = formData.transactions || [];

  return (
    <div className="bg-white rounded-3xl shadow-2xl w-full overflow-hidden max-h-[90vh] flex flex-col animate-fade-in-up">
      <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
        <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{initialData ? '编辑资产' : '录入新资产'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Transactions & Details</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
            <div className="flex gap-2">
                <input type="number" step="0.01" name="expectedRate" value={formData.expectedRate === undefined ? '' : formData.expectedRate} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg" required={!isFloating} />
                {!isFloating && (
                    <select name="interestBasis" value={formData.interestBasis || '365'} onChange={handleChange} className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none">
                        <option value="365">365天</option>
                        <option value="360">360天</option>
                    </select>
                )}
            </div>
          </div>
        </div>
        
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
                <div className="pt-2">
                    <button 
                        type="button" 
                        onClick={() => setFormData(prev => ({...prev, isAutoQuote: !prev.isAutoQuote}))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${formData.isAutoQuote ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${formData.isAutoQuote ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></div>
                        {formData.isAutoQuote ? '自动行情更新: 已开启' : '自动行情更新: 已关闭'}
                    </button>
                </div>
             </div>
        )}

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
             <button 
                type="button"
                onClick={() => setFormData(prev => ({...prev, isRebateReceived: !prev.isRebateReceived}))}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${formData.isRebateReceived ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-500'}`}
             >
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${formData.isRebateReceived ? 'border-white bg-white/20' : 'border-slate-300'}`}>
                    {formData.isRebateReceived && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                返利已到账
             </button>
          </div>
        </div>

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">备注</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none h-24 resize-none transition" />
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    交易流水 (Transaction History)
                </h3>
                
                {initialData && !isCompleted && !showTxForm && !showBatchForm && (
                    <div className="flex gap-2 flex-wrap">
                        {isFloating ? (
                            <>
                                <button onClick={() => openTxForm('Buy')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition flex items-center gap-1">
                                    加仓 (Buy)
                                </button>
                                <button onClick={() => openTxForm('Sell')} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-bold transition flex items-center gap-1">
                                    减仓 (Sell)
                                </button>
                                <button onClick={() => openTxForm('Dividend')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold transition flex items-center gap-1">
                                    分红 (Div)
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => openTxForm('Buy')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition flex items-center gap-1">
                                    追加本金
                                </button>
                                <button onClick={() => openTxForm('Sell')} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-bold transition flex items-center gap-1">
                                    提取本金
                                </button>
                                <button onClick={() => openTxForm('Interest')} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold transition flex items-center gap-1">
                                    记录利息
                                </button>
                                <button onClick={openBatchForm} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg font-bold transition flex items-center gap-1">
                                    批量生成
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Batch Generator Modal */}
            {showBatchForm && (
                <div className="mb-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100 animate-fade-in relative">
                    <h4 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        批量生成交易计划 (Batch Generate)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                        <div>
                            <label className="block text-[10px] font-bold text-purple-400 mb-1">类型 (Type)</label>
                            <select value={batchData.txType} onChange={e => setBatchData({...batchData, txType: e.target.value as TransactionType})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300">
                                <option value="Dividend">派息/分红 (Dividend)</option>
                                <option value="Interest">利息 (Interest)</option>
                                <option value="Fee">手续费 (Fee)</option>
                                <option value="Tax">税费 (Tax)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-purple-400 mb-1">频率 (Frequency)</label>
                            <select value={batchData.frequency} onChange={e => setBatchData({...batchData, frequency: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300">
                                <option value="Weekly">每周 (Weekly)</option>
                                <option value="Monthly">每月 (Monthly)</option>
                                <option value="Quarterly">每季 (Quarterly)</option>
                                <option value="Yearly">每年 (Yearly)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-purple-400 mb-1">计算模式 (Mode)</label>
                            <select value={batchData.calcMode} onChange={e => setBatchData({...batchData, calcMode: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300">
                                <option value="fixed">固定金额 (Fixed Amount)</option>
                                <option value="rate">按年化自动计算 (Auto)</option>
                                <option value="percent">按本金比例 (Percent)</option>
                            </select>
                        </div>
                        
                        {batchData.calcMode === 'fixed' ? (
                            <div>
                                <label className="block text-[10px] font-bold text-purple-400 mb-1">每期金额</label>
                                <input type="number" step="0.01" value={batchData.amount} onChange={e => setBatchData({...batchData, amount: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300" placeholder="0.00" />
                            </div>
                        ) : batchData.calcMode === 'percent' ? (
                            <div>
                                <label className="block text-[10px] font-bold text-purple-400 mb-1">本金百分比 (%)</label>
                                <input type="number" step="0.01" value={batchData.amount} onChange={e => setBatchData({...batchData, amount: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300" placeholder="e.g. 3.5" />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] font-bold text-purple-400 mb-1">计算预览 (Preview)</label>
                                <div className="w-full p-2 bg-purple-100/50 border border-purple-200 rounded-lg text-sm font-mono text-purple-700">
                                    {calculateBatchAmount() > 0 ? calculateBatchAmount().toFixed(2) : '参数不足'}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-bold text-purple-400 mb-1">开始日期 (Start)</label>
                            <input type="date" value={batchData.startDate} onChange={e => setBatchData({...batchData, startDate: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-purple-400 mb-1">结束日期 (End)</label>
                            <input type="date" value={batchData.endDate} onChange={e => setBatchData({...batchData, endDate: e.target.value})} className="w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300" />
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-purple-100 pt-3">
                        <div className="flex gap-4">
                            <button 
                                type="button" 
                                onClick={() => {
                                    const mat = formData.maturityDate;
                                    if(mat) setBatchData({...batchData, endDate: mat});
                                    else onNotify("未设置到期日期", "info");
                                }}
                                className="text-[10px] text-purple-400 hover:text-purple-600 underline"
                            >
                                填充至到期日
                            </button>
                            {batchData.calcMode === 'percent' && (
                                <span className="text-[10px] text-purple-400">
                                    预计每期: {formatCurrency(calculateBatchAmount(), formData.currency)}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleClearFutureDividends} className="px-3 py-1.5 text-red-500 border border-red-200 rounded-lg text-xs hover:bg-red-50">清除未来记录</button>
                            <button type="button" onClick={() => setShowBatchForm(false)} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">取消</button>
                            <button type="button" onClick={handleSaveBatch} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm">立即生成</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Modal (Single) */}
            {showTxForm && (
                <div className="mb-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-fade-in">
                    <h4 className="text-sm font-bold text-indigo-900 mb-3">
                        {editingTxId ? '编辑交易' : `新增交易`}
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">交易类型</label>
                            <select value={txData.type} onChange={e => setTxData({...txData, type: e.target.value as TransactionType})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                                <option value="Buy">{getTxTypeLabel('Buy')}</option>
                                <option value="Sell">{getTxTypeLabel('Sell')}</option>
                                <option value="Dividend">派息/分红 (Dividend)</option>
                                <option value="Interest">利息 (Interest)</option>
                                <option value="Fee">手续费 (Fee)</option>
                                <option value="Tax">税费 (Tax)</option>
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">日期时间</label>
                            <input type="datetime-local" value={txData.date} onChange={e => setTxData({...txData, date: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        
                        {isFloating && txData.type !== 'Dividend' && txData.type !== 'Interest' && txData.type !== 'Fee' && txData.type !== 'Tax' && (
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

            {/* Transaction Table */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[600px]">
                        <thead className="bg-slate-100 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-32">日期 (Date)</th>
                                <th className="p-3 w-20">类型</th>
                                <th className="p-3 text-right w-24">金额 (Amount)</th>
                                {!isFloating ? <th className="p-3 w-0 hidden"></th> : <th className="p-3 text-right w-24">单价/数量</th>}
                                <th className="p-3">备注</th>
                                <th className="p-3 text-right w-20">操作</th>
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
                                            (tx.type === 'Dividend' || tx.type === 'Interest') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            (tx.type === 'Fee' || tx.type === 'Tax') ? 'bg-red-50 text-red-500 border-red-100' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {getTxTypeLabel(tx.type)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium">
                                        {(tx.type === 'Sell' || tx.type === 'Fee' || tx.type === 'Tax') ? '-' : '+'}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    {!isFloating ? <td className="hidden"></td> : (
                                        <td className="p-3 text-right font-mono text-slate-500">
                                            {tx.price && tx.quantity ? `${tx.price} x ${tx.quantity}` : '-'}
                                        </td>
                                    )}
                                    <td className="p-3 text-slate-400 truncate max-w-[100px]">{tx.notes || '-'}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
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
      </div>
      <div className="p-6 border-t border-slate-100 flex justify-end gap-4 shrink-0">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition font-medium">取消</button>
          <button type="submit" onClick={handleSubmit} className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-300 transition transform active:scale-95 font-medium">保存记录</button>
      </div>
    </div>
  );
};

export default InvestmentForm;
