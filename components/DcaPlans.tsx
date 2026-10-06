import React, { useState, useMemo } from 'react';
import { DcaPlan, User, Currency } from '../types';
import { storageService } from '../services/storage';
import { getDcaStatus } from '../utils';
import ConfirmModal from './ConfirmModal';

interface Props {
    user: User | null;
    onNotify: (msg: string, type: 'success' | 'error') => void;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const CURRENCIES: Currency[] = ['CNY', 'USD', 'HKD'];

const emptyForm = {
    name: '',
    amount: '',
    currency: 'CNY' as Currency,
    frequency: 'monthly' as 'weekly' | 'monthly',
    dayOfMonth: '1',
    dayOfWeek: '1',
    startDate: new Date().toISOString().slice(0, 10),
    active: true,
};

const DcaPlans: React.FC<Props> = ({ user, onNotify }) => {
    const [plans, setPlans] = useState<DcaPlan[]>(() => storageService.getDcaPlans());
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const persist = async (next: DcaPlan[]) => {
        setPlans(next);
        await storageService.saveDcaPlans(user, next);
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEdit = (p: DcaPlan) => {
        setEditingId(p.id);
        setForm({
            name: p.name,
            amount: String(p.amount),
            currency: p.currency,
            frequency: p.frequency,
            dayOfMonth: String(p.dayOfMonth || 1),
            dayOfWeek: String(p.dayOfWeek ?? 1),
            startDate: p.startDate,
            active: p.active,
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(form.amount);
        if (!form.name.trim()) { onNotify('请填写计划名称', 'error'); return; }
        if (!amount || amount <= 0) { onNotify('请填写有效的每期金额', 'error'); return; }
        const plan: DcaPlan = {
            id: editingId || `dca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: form.name.trim(),
            amount,
            currency: form.currency,
            frequency: form.frequency,
            dayOfMonth: form.frequency === 'monthly' ? Math.min(Math.max(Number(form.dayOfMonth) || 1, 1), 28) : undefined,
            dayOfWeek: form.frequency === 'weekly' ? Number(form.dayOfWeek) : undefined,
            startDate: form.startDate,
            active: form.active,
            createdAt: editingId ? (plans.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            lastDoneDate: editingId ? plans.find(p => p.id === editingId)?.lastDoneDate : undefined,
        };
        const next = editingId ? plans.map(p => p.id === editingId ? plan : p) : [...plans, plan];
        await persist(next);
        setShowForm(false);
        onNotify(editingId ? '定投计划已更新' : '定投计划已创建', 'success');
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await persist(plans.filter(p => p.id !== deleteId));
        setDeleteId(null);
        onNotify('定投计划已删除', 'success');
    };

    const handleToggle = async (p: DcaPlan) => {
        await persist(plans.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    };

    const handleMarkDone = async (p: DcaPlan) => {
        const today = new Date().toISOString().slice(0, 10);
        await persist(plans.map(x => x.id === p.id ? { ...x, lastDoneDate: today } : x));
        onNotify(`已记录：${p.name} 本期已投`, 'success');
    };

    const sorted = useMemo(() => {
        const rank = (p: DcaPlan) => {
            const s = getDcaStatus(p);
            if (!p.active) return 3;
            if (s.key === 'due') return 0;
            if (s.key === 'soon') return 1;
            return 2;
        };
        return [...plans].sort((a, b) => rank(a) - rank(b));
    }, [plans]);

    const freqLabel = (p: DcaPlan) =>
        p.frequency === 'weekly' ? `每周${WEEKDAYS[p.dayOfWeek ?? 1]}` : `每月${p.dayOfMonth}号`;

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">定投计划</h2>
                    <p className="text-sm text-slate-400 mt-1">设置周期性投入提醒，到期一键标记已投</p>
                </div>
                <button
                    onClick={openAdd}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-800 transition active:scale-95"
                >
                    + 新建计划
                </button>
            </div>

            {sorted.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
                    <p className="text-slate-400 text-sm">还没有定投计划，点击右上角创建一个吧</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sorted.map(p => {
                        const s = getDcaStatus(p);
                        return (
                            <div key={p.id} className={`bg-white p-5 rounded-3xl border shadow-sm ${!p.active ? 'opacity-60 border-slate-100' : s.key === 'due' ? 'border-red-200' : s.key === 'soon' ? 'border-amber-200' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{p.name}</h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {freqLabel(p)} · 每期 {p.amount.toLocaleString()} {p.currency}
                                            {p.lastDoneDate && <span> · 上次 {p.lastDoneDate}</span>}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggle(p)}
                                        className={`text-xs px-2 py-1 rounded-lg font-medium transition ${p.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        {p.active ? '进行中' : '已暂停'}
                                    </button>
                                </div>

                                <div className="mb-4">
                                    {!p.active ? (
                                        <p className="text-sm text-slate-400">计划已暂停</p>
                                    ) : s.key === 'due' ? (
                                        <p className="text-sm font-bold text-red-600">已到期未投（应投日 {s.nextDue}）</p>
                                    ) : s.key === 'soon' ? (
                                        <p className="text-sm font-bold text-amber-600">
                                            {s.daysLeft === 0 ? '今天应投' : `${s.daysLeft} 天后应投`}（{s.nextDue}）
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-500">下期应投：{s.nextDue}</p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {p.active && (s.key === 'due' || s.key === 'soon') && (
                                        <button
                                            onClick={() => handleMarkDone(p)}
                                            className="flex-1 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition active:scale-95"
                                        >
                                            标记已投
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEdit(p)}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-200 transition"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(p.id)}
                                        className="px-4 py-2 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition"
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">{editingId ? '编辑定投计划' : '新建定投计划'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">计划名称</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="如：沪深300定投" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-300 text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">每期金额</label>
                                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                                        placeholder="0.00" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-300 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">币种</label>
                                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as Currency })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">频率</label>
                                    <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as 'weekly' | 'monthly' })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                                        <option value="monthly">每月</option>
                                        <option value="weekly">每周</option>
                                    </select>
                                </div>
                                {form.frequency === 'monthly' ? (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">每月几号</label>
                                        <input type="number" min={1} max={28} value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">每周几</label>
                                        <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                                            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">开始日期</label>
                                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition">
                                    取消
                                </button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition active:scale-95">
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!deleteId}
                title="删除定投计划"
                message="确定删除这个定投计划吗？不会影响已记录的账本数据。"
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
};

export default DcaPlans;
