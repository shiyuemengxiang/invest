
import React, { useState, useEffect } from 'react';
import { Currency, Investment, InvestmentCategory, InvestmentType, CATEGORY_LABELS } from '../types';
import { ToastType } from './Toast';

interface Props {
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  initialData?: Investment | null;
  onNotify: (msg: string, type: ToastType) => void;
}

const InvestmentForm: React.FC<Props> = ({ onSave, onCancel, initialData, onNotify }) => {
  // Helper to extract symbol parts if editing
  const parseInitialSymbol = () => {
      if (!initialData?.symbol) return { code: '', market: 'sh' };
      const s = initialData.symbol;
      if (initialData.category === 'Stock' && initialData.currency === 'CNY') {
          // Check for prefix
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

  // Separate states for Stock Symbol construction
  const [stockCode, setStockCode] = useState(initialSym.code);
  const [stockMarket, setStockMarket] = useState(initialSym.market);

  const [isCompleted, setIsCompleted] = useState(!!initialData?.withdrawalDate);
  const [isFloating, setIsFloating] = useState(initialData?.type === 'Floating');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.depositDate || !formData.principal) {
      onNotify("请填写必要信息（名称、本金、存入时间）", "error");
      return;
    }
    
    // Fixed type requires maturity date
    if (!isFloating && !formData.maturityDate) {
        onNotify("固收型产品请填写到期时间", "error");
        return;
    }

    // Construct Symbol
    let finalSymbol = formData.symbol;
    if (formData.category === 'Stock' && formData.currency === 'CNY' && stockCode) {
        finalSymbol = `${stockMarket}${stockCode}`;
    } else if (isFundOrStock && stockCode) {
        finalSymbol = stockCode; // For funds or non-CNY stocks, just use the code input directly or as mapped
    }

    const newInvestment: Investment = {
      id: initialData?.id || crypto.randomUUID(),
      name: formData.name,
      category: (formData.category as InvestmentCategory) || 'Fixed',
      type: (formData.type as InvestmentType) || 'Fixed',
      currency: (formData.currency as Currency) || 'CNY',
      depositDate: formData.depositDate,
      maturityDate: formData.maturityDate || '', // Optional for Floating
      withdrawalDate: formData.withdrawalDate || null,
      principal: Number(formData.principal),
      quantity: formData.quantity && formData.quantity > 0 ? Number(formData.quantity) : undefined,
      symbol: finalSymbol || undefined,
      isAutoQuote: !!formData.isAutoQuote,
      expectedRate: formData.expectedRate && formData.expectedRate !== 0 ? Number(formData.expectedRate) : undefined,
      currentReturn: formData.currentReturn ? Number(formData.currentReturn) : undefined,
      realizedReturn: formData.realizedReturn ? Number(formData.realizedReturn) : undefined,
      rebate: Number(formData.rebate || 0),
      isRebateReceived: !!formData.isRebateReceived,
      notes: formData.notes || ''
    };
    onSave(newInvestment);
  };

  const isFundOrStock = formData.category === 'Fund' || formData.category === 'Stock';
  const isCNYStock = formData.category === 'Stock' && formData.currency === 'CNY';

  return (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl shadow-slate-200/50 max-w-2xl mx-auto border border-white/50 animate-fade-in-up">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{initialData ? '编辑资产' : '录入新资产'}</h2>
        <span className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg font-medium shadow-sm">Smart Ledger</span>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Product Type Selection */}
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
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition duration-200"
                    placeholder="例如: 某宝30天新人专享 / 腾讯控股"
                    required
                />
            </div>
             <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">分类标签</label>
                 <select 
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition duration-200"
                 >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                 </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2">币种</label>
             <select 
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition duration-200"
             >
                <option value="CNY">CNY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="HKD">HKD (HK$)</option>
             </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">投入本金</label>
            <div className="relative">
                <input
                type="number"
                name="principal"
                value={formData.principal}
                onChange={handleChange}
                className="w-full p-3 pl-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg"
                required
                />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                {isFloating ? '预计年化 (%)' : '预计年化 (%)'} 
                <span className="text-slate-400 font-normal text-xs ml-1">{isFloating ? '(可选)' : '(必填)'}</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="expectedRate"
              value={formData.expectedRate === undefined ? '' : formData.expectedRate}
              onChange={handleChange}
              placeholder={isFloating ? "浮动可不填" : "4.00"}
              className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg`}
              required={!isFloating}
            />
          </div>
        </div>
        
        {/* Quantity & Symbol for Stocks/Funds */}
        {isFundOrStock && (
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">持有份额/股数 (Quantity)</label>
                        <input
                            type="number"
                            step="0.0001"
                            name="quantity"
                            value={formData.quantity === undefined ? '' : formData.quantity}
                            onChange={handleChange}
                            placeholder="0"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {isCNYStock ? '股票代码 (Code)' : '交易代码 (Symbol)'}
                        </label>
                        <input
                            type="text"
                            value={isCNYStock ? stockCode : (formData.symbol || '')}
                            onChange={(e) => {
                                if (isCNYStock) setStockCode(e.target.value);
                                else setFormData(prev => ({ ...prev, symbol: e.target.value }));
                            }}
                            placeholder={isCNYStock ? "如: 600519" : "如: AAPL, 0700.HK"}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono uppercase"
                        />
                    </div>
                </div>

                {/* A-Share Market Selector */}
                {isCNYStock && (
                    <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-sm font-bold text-slate-600 px-2">A股市场:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="market" value="sh" checked={stockMarket === 'sh'} onChange={() => setStockMarket('sh')} className="text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-sm text-slate-700">上证 (SH)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2">
                            <input type="radio" name="market" value="sz" checked={stockMarket === 'sz'} onChange={() => setStockMarket('sz')} className="text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-sm text-slate-700">深证 (SZ)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2">
                            <input type="radio" name="market" value="bj" checked={stockMarket === 'bj'} onChange={() => setStockMarket('bj')} className="text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-sm text-slate-700">北证 (BJ)</span>
                        </label>
                    </div>
                )}
                
                <label className="flex items-center cursor-pointer select-none group pt-2">
                    <input
                        type="checkbox"
                        name="isAutoQuote"
                        checked={!!formData.isAutoQuote}
                        onChange={handleChange}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 transition-colors duration-200"></div>
                    <span className="ml-2 text-sm text-slate-600">开启自动行情更新 (Yahoo/EastMoney)</span>
                </label>
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">买入/存入时间</label>
            <input
              type="date"
              name="depositDate"
              value={formData.depositDate}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                到期/目标时间
                <span className="text-slate-400 font-normal text-xs ml-1">{isFloating ? '(可选)' : '(必填)'}</span>
            </label>
            <input
              type="date"
              name="maturityDate"
              value={formData.maturityDate}
              onChange={handleChange}
              className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none ${!isFloating && !formData.maturityDate ? 'border-red-300' : ''}`}
              required={!isFloating}
            />
          </div>
           <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">卖出/取出时间 <span className="text-slate-400 text-xs">(完结时填)</span></label>
            <input
              type="date"
              name="withdrawalDate"
              value={formData.withdrawalDate || ''}
              onChange={handleChange}
              className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition duration-200 ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
              placeholder="未取出留空"
            />
          </div>
        </div>
        
        {/* Dynamic Section: Current Position Return for Active Floating Items */}
        {isFloating && !isCompleted && (
             <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-indigo-900 mb-2">当前持仓累计收益额 (Current Return)</label>
                        <p className="text-xs text-indigo-700/70 mb-3">
                            {formData.isAutoQuote ? '已开启自动行情，收益额将根据最新价格自动计算更新。' : '手动填写截止目前的浮动盈亏金额，用于计算当前持仓收益率。'}
                        </p>
                        <div className="relative">
                            <input
                                type="number"
                                name="currentReturn"
                                value={formData.currentReturn !== undefined ? formData.currentReturn : ''}
                                onChange={handleChange}
                                disabled={formData.isAutoQuote}
                                className={`w-full p-3 pl-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg text-indigo-900 ${formData.isAutoQuote ? 'bg-indigo-100/50 cursor-not-allowed' : 'bg-white'}`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-4 top-3.5 text-indigo-600/50 text-sm font-medium">{formData.currency}</span>
                        </div>
                    </div>
                 </div>
            </div>
        )}

        {/* Dynamic Section: Actual Return for Completed Items */}
        {isCompleted && (
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-emerald-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-emerald-900 mb-2">实际落袋收益 (不含本金)</label>
                        <p className="text-xs text-emerald-700/70 mb-3">填写后将根据 持有时长 (取出 - 存入) 和 收益 自动计算实际年化收益率。</p>
                        <div className="relative">
                            <input
                                type="number"
                                name="realizedReturn"
                                value={formData.realizedReturn !== undefined ? formData.realizedReturn : ''}
                                onChange={handleChange}
                                className="w-full p-3 pl-4 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-lg text-emerald-900"
                                placeholder="0.00"
                            />
                            <span className="absolute right-4 top-3.5 text-emerald-600/50 text-sm font-medium">{formData.currency}</span>
                        </div>
                    </div>
                 </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-dashed border-slate-200">
           <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">返利/红包金额</label>
            <input
              type="number"
              name="rebate"
              value={formData.rebate}
              onChange={handleChange}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition"
            />
          </div>
          <div className="flex items-center pt-8">
             <label className="flex items-center cursor-pointer select-none group">
                <input
                    type="checkbox"
                    name="isRebateReceived"
                    checked={!!formData.isRebateReceived}
                    onChange={handleChange}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 transition-colors duration-200"></div>
                <span className="ml-3 text-sm font-medium text-slate-600 group-hover:text-slate-800 transition">返利已到账</span>
            </label>
          </div>
        </div>

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">备注</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none h-24 resize-none transition"
            />
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-300 transition transform active:scale-95 font-medium"
          >
            保存记录
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvestmentForm;
