
import React, { useState, useEffect } from 'react';
import { Currency, Investment, InvestmentCategory, CATEGORY_LABELS } from '../types';

interface Props {
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  initialData?: Investment | null;
}

const InvestmentForm: React.FC<Props> = ({ onSave, onCancel, initialData }) => {
  const [formData, setFormData] = useState<Partial<Investment>>(
    initialData || {
      name: '',
      category: 'Fixed',
      currency: 'CNY',
      depositDate: new Date().toISOString().split('T')[0],
      maturityDate: '',
      principal: 10000,
      expectedRate: undefined,
      realizedReturn: undefined,
      rebate: 0,
      isRebateReceived: false,
      withdrawalDate: null,
      notes: ''
    }
  );

  const [isCompleted, setIsCompleted] = useState(!!initialData?.withdrawalDate);

  useEffect(() => {
    setIsCompleted(!!formData.withdrawalDate);
  }, [formData.withdrawalDate]);

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
    if (!formData.name || !formData.depositDate || !formData.maturityDate || !formData.principal) {
      alert("请填写必要信息");
      return;
    }

    const newInvestment: Investment = {
      id: initialData?.id || crypto.randomUUID(),
      name: formData.name,
      category: (formData.category as InvestmentCategory) || 'Fixed',
      currency: (formData.currency as Currency) || 'CNY',
      depositDate: formData.depositDate,
      maturityDate: formData.maturityDate,
      withdrawalDate: formData.withdrawalDate || null,
      principal: Number(formData.principal),
      expectedRate: formData.expectedRate && formData.expectedRate !== 0 ? Number(formData.expectedRate) : undefined,
      realizedReturn: formData.realizedReturn ? Number(formData.realizedReturn) : undefined,
      rebate: Number(formData.rebate || 0),
      isRebateReceived: !!formData.isRebateReceived,
      notes: formData.notes || ''
    };
    onSave(newInvestment);
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-xl shadow-slate-200/50 max-w-2xl mx-auto border border-white/50 animate-fade-in-up">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{initialData ? '编辑资产' : '录入新资产'}</h2>
        <span className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg font-medium shadow-sm">Smart Ledger</span>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
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
                 <label className="block text-sm font-semibold text-slate-700 mb-2">类型</label>
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
                预计年化率 (%) <span className="text-slate-400 font-normal text-xs">(可选)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="expectedRate"
              value={formData.expectedRate === undefined ? '' : formData.expectedRate}
              onChange={handleChange}
              placeholder="浮动可不填"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-mono text-lg"
            />
          </div>
        </div>

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
            <label className="block text-sm font-semibold text-slate-700 mb-2">到期/目标时间</label>
            <input
              type="date"
              name="maturityDate"
              value={formData.maturityDate}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none"
              required
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
        
        {/* Dynamic Section: Show Actual Return input if withdrawal date is set */}
        {isCompleted && (
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="mt-1 text-emerald-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-emerald-900 mb-2">实际落袋收益 (不含本金)</label>
                        <p className="text-xs text-emerald-700/70 mb-3">填写后将根据 持有时长 和 收益 自动计算实际年化收益率。</p>
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
