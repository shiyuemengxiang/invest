import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption, Transaction } from './types';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface ThemeConfig {
    sidebar: string;
    accent: string;
    button: string;
    text: string;
    icon: string;
    navActive: string;
    navHover: string;
}

export const THEMES: Record<ThemeOption, ThemeConfig> = {
    slate: { sidebar: 'bg-slate-900 text-slate-300', accent: 'from-slate-700 to-slate-900', button: 'bg-slate-900 hover:bg-slate-800', text: 'text-slate-600', icon: 'text-slate-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    midnight: { sidebar: 'bg-black text-gray-400', accent: 'from-gray-800 to-black', button: 'bg-black hover:bg-gray-900', text: 'text-gray-600', icon: 'text-gray-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    ocean: { sidebar: 'bg-blue-900 text-blue-200', accent: 'from-blue-600 to-blue-800', button: 'bg-blue-600 hover:bg-blue-700', text: 'text-blue-600', icon: 'text-blue-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    forest: { sidebar: 'bg-emerald-900 text-emerald-100', accent: 'from-emerald-600 to-emerald-800', button: 'bg-emerald-600 hover:bg-emerald-700', text: 'text-emerald-600', icon: 'text-emerald-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    sunset: { sidebar: 'bg-rose-900 text-rose-100', accent: 'from-rose-600 to-rose-800', button: 'bg-rose-600 hover:bg-rose-700', text: 'text-rose-600', icon: 'text-rose-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    royal: { sidebar: 'bg-indigo-950 text-indigo-100', accent: 'from-indigo-600 to-purple-800', button: 'bg-indigo-700 hover:bg-indigo-800', text: 'text-indigo-700', icon: 'text-indigo-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    teal: { sidebar: 'bg-teal-900 text-teal-100', accent: 'from-teal-600 to-cyan-800', button: 'bg-teal-700 hover:bg-teal-800', text: 'text-teal-700', icon: 'text-teal-500', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    amber: { sidebar: 'bg-amber-950 text-amber-100', accent: 'from-amber-500 to-orange-700', button: 'bg-amber-700 hover:bg-amber-800', text: 'text-amber-700', icon: 'text-amber-500', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    crimson: { sidebar: 'bg-red-950 text-red-100', accent: 'from-red-700 to-red-900', button: 'bg-red-800 hover:bg-red-900', text: 'text-red-800', icon: 'text-red-500', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    pink: { sidebar: 'bg-fuchsia-900 text-fuchsia-100', accent: 'from-fuchsia-500 to-pink-700', button: 'bg-fuchsia-700 hover:bg-fuchsia-800', text: 'text-fuchsia-700', icon: 'text-fuchsia-400', navActive: 'bg-white/10 text-white font-bold', navHover: 'hover:bg-white/5 opacity-80' },
    lavender: { sidebar: 'bg-violet-50 text-violet-900 border-r border-violet-100', accent: 'from-violet-400 to-violet-600', button: 'bg-violet-500 hover:bg-violet-600', text: 'text-violet-600', icon: 'text-violet-400', navActive: 'bg-violet-200 text-violet-900 font-bold shadow-sm', navHover: 'hover:bg-violet-100 text-violet-700' },
    mint: { sidebar: 'bg-emerald-50 text-emerald-900 border-r border-emerald-100', accent: 'from-emerald-400 to-teal-500', button: 'bg-emerald-500 hover:bg-emerald-600', text: 'text-emerald-600', icon: 'text-emerald-500', navActive: 'bg-emerald-200 text-emerald-900 font-bold shadow-sm', navHover: 'hover:bg-emerald-100 text-emerald-700' },
    sky: { sidebar: 'bg-sky-50 text-sky-900 border-r border-sky-100', accent: 'from-sky-400 to-blue-500', button: 'bg-sky-500 hover:bg-sky-600', text: 'text-sky-600', icon: 'text-sky-500', navActive: 'bg-sky-200 text-sky-900 font-bold shadow-sm', navHover: 'hover:bg-sky-100 text-sky-700' },
    sakura: { sidebar: 'bg-pink-50 text-pink-900 border-r border-pink-100', accent: 'from-pink-400 to-rose-500', button: 'bg-pink-500 hover:bg-pink-600', text: 'text-pink-600', icon: 'text-pink-400', navActive: 'bg-pink-200 text-pink-900 font-bold shadow-sm', navHover: 'hover:bg-pink-100 text-pink-700' },
    ivory: { sidebar: 'bg-white text-slate-800 border-r border-slate-200', accent: 'from-slate-400 to-slate-600', button: 'bg-slate-700 hover:bg-slate-800', text: 'text-slate-700', icon: 'text-slate-400', navActive: 'bg-slate-100 text-slate-900 font-bold shadow-sm', navHover: 'hover:bg-slate-600' }
};

export const migrateInvestmentData = (item: any): Investment => {
    if (item.transactions && Array.isArray(item.transactions) && item.transactions.length > 0) {
        return recalculateInvestmentState(item);
    }

    const transactions: Transaction[] = [];
    
    transactions.push({
        id: self.crypto.randomUUID(),
        date: item.depositDate,
        type: 'Buy',
        amount: Number(item.principal),
        quantity: item.quantity,
        price: item.quantity ? Number(item.principal) / Number(item.quantity) : undefined,
        notes: 'Initial Deposit (Migrated)'
    });

    if (item.withdrawalDate) {
        transactions.push({
            id: self.crypto.randomUUID(),
            date: item.withdrawalDate,
            type: 'Sell',
            amount: Number(item.principal),
            quantity: item.quantity,
            notes: 'Full Withdrawal (Migrated)'
        });
    }

    const newItem: Investment = {
        ...item,
        transactions,
        currentPrincipal: 0,
        totalCost: 0,
        totalRealizedProfit: 0,
        currentQuantity: 0,
        interestBasis: item.interestBasis || '365'
    };

    return recalculateInvestmentState(newItem);
};

export const recalculateInvestmentState = (item: Investment): Investment => {
    let currentPrincipal = 0;
    let currentQuantity = 0;
    let totalCost = 0;
    let totalRealizedProfit = 0;
    
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];

    const sortedTxs = [...(item.transactions || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const tx of sortedTxs) {
        const amount = Number(tx.amount) || 0;
        const qty = Number(tx.quantity) || 0;
        const txDateStr = tx.date.split('T')[0];

        if (tx.type === 'Buy') {
            currentPrincipal += amount;
            totalCost += amount;
            if (qty) currentQuantity += qty;
            
        } else if (tx.type === 'Sell') {
            if (item.type === 'Floating' && currentQuantity > 0 && qty > 0) {
                // AVCO Logic
                const avgCostPerUnit = currentPrincipal / currentQuantity;
                const costOfSold = avgCostPerUnit * qty;
                const realizedTxProfit = amount - costOfSold;
                
                totalRealizedProfit += realizedTxProfit;
                currentPrincipal -= costOfSold;
                currentQuantity -= qty;
            } else {
                // Cash Basis / Fixed Logic
                currentPrincipal -= amount;
                
                if (currentPrincipal < 0) {
                    if (item.type === 'Floating') {
                        totalRealizedProfit += Math.abs(currentPrincipal);
                    }
                    currentPrincipal = 0;
                }
                
                if (qty) currentQuantity -= qty;
            }

        } else if (tx.type === 'Dividend' || tx.type === 'Interest') {
            if (txDateStr <= todayISO) {
                totalRealizedProfit += amount;
            }
        } else if (tx.type === 'Fee' || tx.type === 'Tax') {
             if (txDateStr <= todayISO) {
                totalRealizedProfit -= amount;
            }
        }
    }

    currentPrincipal = Math.max(0, Number(currentPrincipal.toFixed(4)));
    currentQuantity = Math.max(0, Number(currentQuantity.toFixed(4)));
    totalRealizedProfit = Number(totalRealizedProfit.toFixed(4));

    return {
        ...item,
        transactions: sortedTxs,
        currentPrincipal,
        currentQuantity,
        totalCost,
        totalRealizedProfit, 
        principal: currentPrincipal, 
        quantity: currentQuantity    
    };
};

export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

export const getDaysDiff = (start: string, end: string): number => {
  const d1 = new Date(start).setHours(0,0,0,0);
  const d2 = new Date(end).setHours(0,0,0,0);
  return Math.round((d2 - d1) / MS_PER_DAY);
};

export const getDaysRemaining = (targetDate: string): number => {
  if (!targetDate) return 0;
  const today = new Date().setHours(0,0,0,0);
  const target = new Date(targetDate).setHours(0,0,0,0);
  return Math.round((target - today) / MS_PER_DAY);
};

export const convertCurrency = (amount: number, from: Currency, to: Currency, rates: ExchangeRates): number => {
    if (from === to) return amount;
    const inCNY = amount * rates[from];
    return inCNY / rates[to];
};

export const calculateDailyReturn = (item: Investment): number => {
    const todayStart = new Date().setHours(0,0,0,0);
    const depositStart = new Date(item.depositDate).setHours(0,0,0,0);
    if (todayStart < depositStart) return 0;
    if (item.withdrawalDate) return 0;

    const activePrincipal = item.currentPrincipal; 
    let dailyVal = 0;

    if (item.type === 'Floating') {
        if (item.estGrowth && activePrincipal > 0) {
            const currentTotalValue = activePrincipal + (item.currentReturn || 0);
            const baseValue = Math.max(0, currentTotalValue);
            dailyVal = baseValue * (item.estGrowth / 100);
        }
    } else if (item.type === 'Fixed' && item.expectedRate) {
        const basis = Number(item.interestBasis || 365);
        dailyVal = activePrincipal * (item.expectedRate / 100) / basis;
    }

    const todayISO = new Date().toISOString().split('T')[0];
    if (item.transactions) {
        item.transactions.forEach(tx => {
            const txDate = tx.date.split('T')[0];
            if (txDate === todayISO && (tx.type === 'Fee' || tx.type === 'Tax')) {
                dailyVal -= tx.amount;
            }
        });
    }

    return dailyVal;
};

export const getTimeFilterRange = (filter: TimeFilter, customStart?: string, customEnd?: string): { start: Date, end: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(today);

    switch (filter) {
        case '1m': start.setMonth(start.getMonth() - 1); break;
        case '3m': start.setMonth(start.getMonth() - 3); break;
        case '6m': start.setMonth(start.getMonth() - 6); break;
        case '1y': start.setFullYear(start.getFullYear() - 1); break;
        case 'ytd': start = new Date(now.getFullYear(), 0, 1); break;
        case 'mtd': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'custom': 
            if (customStart) start = new Date(customStart);
            if (customEnd) {
                const e = new Date(customEnd);
                e.setHours(23, 59, 59, 999);
                return { start, end: e };
            }
            break;
        case 'all':
            return { start: new Date('1970-01-01'), end };
    }
    start.setHours(0,0,0,0);
    return { start, end };
};

// ----------------------------------------------------------------
// [逻辑修复] 全局统计函数 (All Time)
// ----------------------------------------------------------------
export const calculatePortfolioStats = (items: Investment[]) => {
  let totalInvested = 0;
  let activePrincipal = 0;
  let completedPrincipal = 0;
  let totalRebate = 0;
  let pendingRebate = 0;
  let receivedRebate = 0;
  let realizedInterest = 0;
  let projectedTotalProfit = 0;
  let todayEstProfit = 0;
  
  let totalCapitalWACC = 0; // NEW: Sum of (Capital * Days Held) for MWR
  
  const todayISO = new Date().toISOString().split('T')[0];

  items.forEach(item => {
    const metrics = calculateItemMetrics(item);
    
    totalInvested += item.totalCost; 
    totalRebate += item.rebate;
    
    // WACC Calculation (Total Days from Deposit to Withdrawal/Today)
    const holdingDays = metrics.isCompleted 
        ? getDaysDiff(item.depositDate, item.withdrawalDate) 
        : getDaysDiff(item.depositDate, new Date().toISOString().split('T')[0]);
        
    const capitalBase = item.totalCost; // Use initial investment cost as the capital base
    if (holdingDays > 0 && capitalBase > 0) {
        totalCapitalWACC += capitalBase * holdingDays;
    }
    
    // Projected Total Profit（12月版口径：已实现 + 未实现 + 已到账返利，三者互不重叠）
    let itemRealized = 0;
    if (metrics.isCompleted) {
        itemRealized = metrics.baseInterest;
    } else {
        itemRealized = item.totalRealizedProfit;
    }

    let itemUnrealized = 0;
    if (!metrics.isCompleted) {
        if (item.type === 'Fixed') {
            itemUnrealized = metrics.accruedReturn;
        } else {
            // 浮动资产已清仓(qty<=0)即使未完结，浮盈也为0
            if (item.type === 'Floating' && (!item.currentQuantity || item.currentQuantity <= 0)) {
                itemUnrealized = 0;
            } else {
                itemUnrealized = item.currentReturn || 0;
            }
        }
    }
    projectedTotalProfit += (itemRealized + itemUnrealized + (item.isRebateReceived ? item.rebate : 0));

    // Fee deduction for projection (Future fees are NOT included in MWR Numerator)
    if (!metrics.isCompleted && item.transactions) {
        item.transactions.forEach(tx => {
            const txDate = tx.date.split('T')[0];
            if (txDate > todayISO && (tx.type === 'Fee' || tx.type === 'Tax')) {
                projectedTotalProfit -= tx.amount;
            }
        });
    }
    
    if (!metrics.isCompleted) {
        todayEstProfit += calculateDailyReturn(item);
    }

    if (item.isRebateReceived) {
      receivedRebate += item.rebate;
    } else {
      pendingRebate += item.rebate;
    }

    if (metrics.isCompleted) {
      completedPrincipal += item.totalCost;
      realizedInterest += metrics.baseInterest;
    } else {
      activePrincipal += item.currentPrincipal;
      realizedInterest += item.totalRealizedProfit;
    }

    // Weighted Yield
    if (!metrics.isPending && (metrics.hasYieldInfo || item.rebate > 0)) { 
        // We safely remove the old TWR summation which is now replaced by MWR logic.
    }
  });
  
  // -------------------------------------------------------------
  // 🔥 核心修复点：将 "已到账返利" 累加到 "总已落袋收益" 中
  // -------------------------------------------------------------
  realizedInterest += receivedRebate;

  let portfolioYield = 0;
  if (totalCapitalWACC > 0) {
      // MWR / WACC Annualized Yield = (Total Profit / Total Capital WACC) * 365 * 100%
      portfolioYield = (projectedTotalProfit / totalCapitalWACC) * 365 * 100;
  }
  
  const projectedTotalYield = totalInvested > 0 ? (projectedTotalProfit / totalInvested) * 100 : 0;

  return {
    totalInvested,
    activePrincipal,
    completedPrincipal,
    totalRebate,
    pendingRebate,
    receivedRebate,
    realizedInterest, // 现在的 realizedInterest 已经包含返利了
    projectedTotalProfit,
    projectedTotalYield,
    todayEstProfit,
    comprehensiveYield: portfolioYield,
    totalCapitalWACC // NEW RETURN FIELD
  };
};

// ----------------------------------------------------------------
// Period Stats Logic (Fixed: use totalCost for closed items)
// ----------------------------------------------------------------
export const calculatePeriodStats = (items: Investment[], start: Date, end: Date) => {
    let totalInvested = 0; 
    let periodProfit = 0;
    let realizedInPeriod = 0;
    
    let totalCapitalWACC = 0; // NEW: Sum of (Capital * Days Held) for MWR
    
    let totalRebate = 0;
    let pendingRebate = 0;
    let receivedRebate = 0;

    const isBetween = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= start && d <= end;
    };

    items.forEach(item => {
        const depositDate = new Date(item.depositDate);
        const withdrawalDate = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
        
        if (depositDate > end) return;
        if (withdrawalDate && withdrawalDate < start) return;

        const overlapStart = depositDate > start ? depositDate : start;
        const itemEnd = withdrawalDate || item.maturityDate ? new Date(item.maturityDate) : null || end;
        const effectiveEnd = withdrawalDate ? (withdrawalDate < end ? withdrawalDate : end) : end;
        const overlapEnd = effectiveEnd < end ? effectiveEnd : end;
        
        let overlapDays = 0;
        if (overlapEnd > overlapStart) {
            overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY;
        }

        // WACC Calculation (Period WACC)
        const capitalBase = item.totalCost; // Use total investment cost as the capital base
        if (overlapDays > 0 && capitalBase > 0) {
             // WACC should only count holding days *within* the filter period
             totalCapitalWACC += capitalBase * overlapDays;
        }


        let itemPeriodProfit = 0;
        const calculationPrincipal = item.currentPrincipal > 0.01 ? item.currentPrincipal : item.totalCost;
        let fixedInterestProjection = 0;

        // 1. Fixed Interest Projection (for Projected Profit)
        if (item.type === 'Fixed' && item.expectedRate && calculationPrincipal > 0) {
            const basis = Number(item.interestBasis || 365);
            fixedInterestProjection = calculationPrincipal * (item.expectedRate / 100) * (overlapDays / basis);
            itemPeriodProfit += fixedInterestProjection;
        }

        // 2. Realized Completion Net Profit (The core fix for '已完结项目净利')
        const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;
        
        if (isCompletedInPeriod) {
            const metrics = calculateItemMetrics(item);
            
            // metrics.baseInterest: Total fixed interest (for Fixed) OR total realized return (for Floating)
            let netCompletionGain = metrics.baseInterest; 
            
            // Subtract P&L Transactions (Div/Int/Fee/Tax) AND Rebates that were realized BEFORE the period start.
            let realizedPnlTxBeforePeriod = 0;
            if (item.transactions) {
                item.transactions.forEach(tx => {
                    const d = new Date(tx.date);
                    if (d < start) {
                        if (tx.type === 'Dividend' || tx.type === 'Interest') realizedPnlTxBeforePeriod += tx.amount;
                        else if (tx.type === 'Fee' || tx.type === 'Tax') realizedPnlTxBeforePeriod -= tx.amount;
                    }
                });
            }
            // 考虑提前收到的返利
            if (item.isRebateReceived && new Date(item.depositDate) < start) {
                realizedPnlTxBeforePeriod += item.rebate;
            }
            
            // Completion Net Profit = Total Lifetime Net Gain - Portion realized BEFORE the period
            const completionNetProfit = netCompletionGain - realizedPnlTxBeforePeriod;
            
            // Add to the period's total realized amount (Fixes the main card issue)
            realizedInPeriod += completionNetProfit;

            // Adjust projected profit (Fixes consistency with the breakdown chart):
            if (item.type === 'Fixed') {
                // For Fixed, the completion net profit replaces the original interest projection.
                itemPeriodProfit = itemPeriodProfit - fixedInterestProjection + completionNetProfit;
            } else {
                itemPeriodProfit += completionNetProfit;
            }
        }
        
        // 3. Rebate 
        if (isBetween(item.depositDate)) {
            totalRebate += item.rebate;
            itemPeriodProfit += item.rebate;
            if (item.isRebateReceived) {
                realizedInPeriod += item.rebate;
                receivedRebate += item.rebate;
            } else {
                pendingRebate += item.rebate;
            }
        }

        // 4. P&L Transactions (Div/Int/Fee/Tax) - only those *in* the period
        if (item.transactions) {
            item.transactions.forEach(tx => {
                // Only count transactions if the item was NOT completed in the period.
                if (!isCompletedInPeriod) {
                    if (isBetween(tx.date)) {
                        if (tx.type === 'Dividend' || tx.type === 'Interest') {
                            itemPeriodProfit += tx.amount;
                            realizedInPeriod += tx.amount;
                        } else if (tx.type === 'Fee' || tx.type === 'Tax') {
                            itemPeriodProfit -= tx.amount;
                            realizedInPeriod -= tx.amount;
                        } 
                    }
                }
            });
        }
        
        periodProfit += itemPeriodProfit;
        totalInvested += capitalBase; // Total invested capital in the period (for UI consistency)
    })

    let portfolioYield = 0;
    if (totalCapitalWACC > 0) {
        // MWR / WACC Annualized Yield = (Period Profit / Total Capital WACC) * 365 * 100%
        portfolioYield = (periodProfit / totalCapitalWACC) * 365 * 100;
    }

    return {
        projectedTotalProfit: periodProfit,
        realizedInterest: realizedInPeriod,
        activePrincipal: totalInvested, // Total invested capital in the period (for UI consistency)
        comprehensiveYield: portfolioYield,
        totalInvested: totalInvested,
        completedPrincipal: 0,
        totalRebate: totalRebate, 
        pendingRebate: pendingRebate, 
        receivedRebate: receivedRebate,
        projectedTotalYield: 0,
        todayEstProfit: 0,
        totalCapitalWACC: totalCapitalWACC // NEW RETURN FIELD
    };
};

export const calculateItemMetrics = (item: Investment) => {
    const now = new Date();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const deposit = new Date(item.depositDate);
    const depositStart = new Date(item.depositDate).setHours(0, 0, 0, 0);
    const maturity = item.maturityDate ? new Date(item.maturityDate) : null;
    const withdrawal = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
    const isCompleted = !!item.withdrawalDate;
    const isPending = todayStart < depositStart;

    const activePrincipal = item.currentPrincipal;
    const currentQuantity = item.currentQuantity || 0;
    const interestBasis = Number(item.interestBasis || 365);

    // 1. 计算实际资金占用时长 (Holding Duration)
    // 如果完结，就是 取出 - 买入；如果未完结，就是 今天 - 买入
    let occupiedDurationMs = 0;
    if (!isPending) {
        if (isCompleted && withdrawal) {
            occupiedDurationMs = withdrawal.getTime() - deposit.getTime();
        } else {
            occupiedDurationMs = now.getTime() - deposit.getTime();
        }
    }
    occupiedDurationMs = Math.max(0, occupiedDurationMs);
    const realDurationDays = Math.round(occupiedDurationMs / MS_PER_DAY);

    let baseInterest = 0;
    let annualizedYield = 0;
    let holdingYield = 0;
    let hasYieldInfo = true;
    let accruedReturn = 0;

    if (isPending) {
        hasYieldInfo = true;
        if (item.type === 'Fixed' && item.expectedRate) {
            annualizedYield = item.expectedRate;
        }
    } else if (isCompleted) {

        if (item.type === 'Floating') {
            // 浮动资产完结逻辑
            if (item.totalRealizedProfit !== 0) {
                baseInterest = item.totalRealizedProfit;
            } else if (item.currentReturn !== undefined && item.currentReturn !== 0) {
                baseInterest = item.currentReturn;
            } else {
                baseInterest = 0;
            }
        } else {
            // 🔴 修复 Fixed 资产完结逻辑：计息时长 vs 资金占用时长

            // 1. 计算计息天数 (Accrual Days)
            // 逻辑：计息天数不能超过到期日。如果提前取出，按实际天数算；如果超期取出，按到期日算。
            let accrualDays = realDurationDays;

            if (maturity) {
                const maturityDurationMs = maturity.getTime() - deposit.getTime();
                const maturityDays = Math.round(maturityDurationMs / MS_PER_DAY);

                // 如果实际持仓超过了到期日，计息天数封顶为到期日
                if (realDurationDays > maturityDays) {
                    accrualDays = maturityDays;
                }
            }

            // 2. 计算预期产生的利息 (Fixed Interest)
            // 使用 accrualDays (计息天数) 来计算金额
            const fixedInterest = item.expectedRate && item.totalCost > 0
                ? item.totalCost * (item.expectedRate / 100) * (accrualDays / interestBasis)
                : 0;

            // 优先使用手动填写的 realizedReturn (totalRealizedProfit)，如果没有则使用自动计算的
            baseInterest = item.totalRealizedProfit !== 0 ? item.totalRealizedProfit : fixedInterest;
        }

        const finalGain = baseInterest + (item.isRebateReceived ? item.rebate : 0);
        const calcBase = item.totalCost > 0 ? item.totalCost : 1;

        if (calcBase > 0) {
            holdingYield = (finalGain / calcBase) * 100;

            // 🔴 修复年化计算：使用 realDurationDays (实际资金占用时长) 作为分母
            // 公式：(总收益率) / (实际占用天数 / 365)
            if (realDurationDays > 0) {
                annualizedYield = (holdingYield / realDurationDays) * 365; // 这里通常用365作为年化标准，或者用 interestBasis 也可以
            }
        }

    } else if (item.type === 'Fixed' && item.expectedRate) {
        const rate = item.expectedRate;
        annualizedYield = rate;

        const relevantTxs = (item.transactions || []).filter(t => t.type === 'Buy' || t.type === 'Sell');
        const sortedTxs = [...relevantTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const calculateSegmentedInterest = (endDate: Date) => {
            let totalInterest = 0;
            let currentBalance = 0;
            for (let i = 0; i < sortedTxs.length; i++) {
                const tx = sortedTxs[i];
                const txDate = new Date(tx.date);
                const nextTx = sortedTxs[i + 1];
                const nextDate = nextTx ? new Date(nextTx.date) : endDate;
                if (tx.type === 'Buy') currentBalance += tx.amount;
                else if (tx.type === 'Sell') currentBalance -= tx.amount;

                const segmentEnd = nextDate < endDate ? nextDate : endDate;
                if (segmentEnd > txDate) {
                    const days = (segmentEnd.getTime() - txDate.getTime()) / MS_PER_DAY;
                    if (days > 0 && currentBalance > 0) {
                        totalInterest += currentBalance * (rate / 100) * (days / interestBasis);
                    }
                }
                if (new Date(nextTx?.date || '') > endDate) break;
            }
            return totalInterest;
        };
        // 1. 计算【截止今日】的应计收益 (用于持有率、净值)
        accruedReturn = calculateSegmentedInterest(now);
        // 2. 计算【持有到期】的预期总收益 (用于列表显示预期收益)
        // 如果有到期日，算到期；否则(永续)暂按今日算
        if (maturity) {
            baseInterest = calculateSegmentedInterest(maturity);
        } else {
            baseInterest = accruedReturn;
        }
        // baseInterest = accruedReturn; 
        // 3. 计算持有收益率 (Yield)
        // 🔥 关键修正：分母应该是"应计收益"，而不是"到期收益"
        // 这样显示的持有率才是当前实际赚到的比例
        if (activePrincipal > 0) {
            holdingYield = (accruedReturn / activePrincipal) * 100;
        } else {
            hasYieldInfo = false;
        }

    } else if (item.type === 'Floating') {

        if (!item.currentQuantity || item.currentQuantity <= 0) {
            baseInterest = 0;
        }
        else if (item.currentReturn !== undefined) {
            baseInterest = item.currentReturn;
            const totalValueChange = item.currentReturn + item.totalRealizedProfit;
            const costBasis = item.totalCost > 0 ? item.totalCost : activePrincipal;

            if (costBasis > 0) {
                holdingYield = (totalValueChange / costBasis) * 100;
                if (realDurationDays > 0) {
                    annualizedYield = (holdingYield / (realDurationDays / 365));
                }
            }
        } else if (item.expectedRate) {
            const rate = item.expectedRate;
            annualizedYield = rate;
            baseInterest = activePrincipal * (rate / 100) * (realDurationDays / 365);
            if (activePrincipal > 0) holdingYield = (baseInterest / activePrincipal) * 100;
        } else {
            if (item.totalRealizedProfit !== 0) {
                baseInterest = item.totalRealizedProfit;
                hasYieldInfo = true;
                const costBasis = item.totalCost > 0 ? item.totalCost : activePrincipal;
                if (costBasis > 0) {
                    holdingYield = (baseInterest / costBasis) * 100;
                    if (realDurationDays > 0) {
                        annualizedYield = (holdingYield / (realDurationDays / 365));
                    }
                }
            } else {
                hasYieldInfo = false;
            }
        }
    } else {
        hasYieldInfo = false;
    }

    const totalReturn = baseInterest + item.rebate + (!isCompleted && item.type === 'Floating' ? item.totalRealizedProfit : 0);

    let comprehensiveYield = 0;
    const yieldBase = isCompleted || item.type === 'Floating' ? item.totalCost : activePrincipal;

    if (!isPending && (hasYieldInfo || item.rebate > 0) && realDurationDays > 0 && yieldBase > 0) {
        const gainForYield = (isCompleted ? baseInterest : (item.currentReturn || 0) + item.totalRealizedProfit) + (item.isRebateReceived ? item.rebate : 0);
        // 修复：如果已清仓未完结，gainForYield 应为 totalRealizedProfit + rebate
        const effectiveGain = (!isCompleted && item.type === 'Floating' && (!item.currentQuantity || item.currentQuantity <= 0))
            ? (item.totalRealizedProfit + (item.isRebateReceived ? item.rebate : 0))
            : gainForYield;

        comprehensiveYield = (effectiveGain / yieldBase) * 100 / (realDurationDays / 365);
    } else if (isPending && item.type === 'Fixed' && item.expectedRate) {
        comprehensiveYield = item.expectedRate;
    }

    // 修复: 成本价与现价计算
    let unitCost = 0;
    let currentPrice = 0;
    const calcQuantity = isCompleted ? (item.quantity || 0) : (item.currentQuantity || 0);
    const calcPrincipal = isCompleted ? item.totalCost : activePrincipal;

    if (calcQuantity > 0) {
        unitCost = calcPrincipal / calcQuantity;
        const profitValue = isCompleted ? baseInterest : (item.currentReturn || accruedReturn);
        const currentVal = calcPrincipal + profitValue;
        currentPrice = currentVal / calcQuantity;
    }

    return {
        interestDays: realDurationDays,
        baseInterest,
        totalReturn,
        profit: totalReturn,
        realDurationDays,
        annualizedYield,
        holdingYield,
        comprehensiveYield,
        accruedReturn,
        isCompleted,
        isPending,
        hasYieldInfo,
        daysRemaining: item.maturityDate ? getDaysRemaining(item.maturityDate) : 0,
        unitCost,
        currentPrice
    };
};

export const calculateTotalValuation = (items: Investment[], targetCurrency: Currency, rates: ExchangeRates) => {
    let totalValuation = 0;

    items.forEach(item => {
        const metrics = calculateItemMetrics(item);
        let value = item.currentPrincipal;

        if (metrics.isCompleted) {
            value = 0; 
        } else if (metrics.isPending) {
            value = item.currentPrincipal; 
        } else {
            if (item.type === 'Fixed') {
                 value += metrics.accruedReturn;
            } else {
                 if (metrics.currentReturn !== undefined) {
                     value += metrics.currentReturn;
                 } else {
                    // If currentReturn is not set, use accrued interest or keep currentPrincipal as proxy
                    value += metrics.accruedReturn;
                 }
            }
            value += item.totalRealizedProfit; // Add realized profit back for valuation
        }
        totalValuation += convertCurrency(value, item.currency, targetCurrency, rates);
    });

    return totalValuation;
};

export const formatCurrency = (amount: number, currency: Currency = 'CNY'): string => {
    const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';
    const safeAmount = amount || 0;
    return `${symbol}${safeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPercent = (val: number): string => {
    const safeVal = val || 0;
    return `${safeVal.toFixed(2)}%`;
};

export const filterInvestmentsByTime = (items: Investment[], filter: TimeFilter, customStart?: string, customEnd?: string): Investment[] => {
    if (filter === 'all') return items;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return items.filter(item => {
        const date = new Date(item.depositDate);

        if (filter === 'custom') {
            if (customStart && customEnd) {
                const start = new Date(customStart);
                const end = new Date(customEnd);
                end.setHours(23, 59, 59, 999);
                return date >= start && date <= end;
            }
            return true;
        }

        let cutoff = new Date(today);

        switch (filter) {
            case '1m': cutoff.setMonth(cutoff.getMonth() - 1); break;
            case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
            case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
            case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
            case 'ytd': cutoff = new Date(now.getFullYear(), 0, 1); break;
            case 'mtd': cutoff = new Date(now.getFullYear(), now.getMonth(), 1); break;
            default: return true;
        }
        return date >= cutoff;
    });
};
// ---- XIRR 年化收益率（阶段五-4b）----
// 解方程 Σ amount_i / (1+r)^((d_i - d_0)/365) = 0，牛顿迭代 + 二分兜底。
// 约定：投入为负（流出），收回为正（流入）；至少一正一负才有解。
export interface CashFlow {
    date: string;   // YYYY-MM-DD
    amount: number; // 正=流入，负=流出
}

// 解析现金流日期：兼容 YYYY-MM-DD 和带时间的格式（含 T/Z）
function parseFlowDate(s: string): number {
    if (!s) return NaN;
    const t = new Date(s.length <= 10 ? s + 'T00:00:00' : s).getTime();
    return t;
}

export function calculateXIRR(cashflows: CashFlow[]): number | null {
    const flows = cashflows
        .map(f => ({ t: parseFlowDate(f.date), amount: f.amount }))
        .filter(f => !isNaN(f.t) && f.amount !== 0)
        .sort((a, b) => a.t - b.t);
    if (flows.length < 2) return null;
    if (!flows.some(f => f.amount > 0) || !flows.some(f => f.amount < 0)) return null;

    const t0 = flows[0].t;
    const years = flows.map(f => (f.t - t0) / (365 * 86400 * 1000));
    const npv = (r: number) => flows.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, years[i]), 0);
    const dnpv = (r: number) => flows.reduce((s, f, i) => s - years[i] * f.amount / Math.pow(1 + r, years[i] + 1), 0);

    // 牛顿迭代
    let r = 0.1;
    for (let i = 0; i < 100; i++) {
        const v = npv(r);
        if (Math.abs(v) < 1e-7) return r;
        const d = dnpv(r);
        if (!isFinite(d) || Math.abs(d) < 1e-12) break;
        const nr = r - v / d;
        if (!isFinite(nr) || nr <= -1) break;
        if (Math.abs(nr - r) < 1e-9) return nr;
        r = nr;
    }
    // 二分兜底
    let lo = -0.9999, hi = 10;
    const vlo = npv(lo), vhi = npv(hi);
    if (!isFinite(vlo) || !isFinite(vhi) || vlo * vhi > 0) return null;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const v = npv(mid);
        if (Math.abs(v) < 1e-7) return mid;
        if (vlo * v < 0) { hi = mid; } else { lo = mid; }
    }
    return (lo + hi) / 2;
}

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---- 单笔持仓现金流构造（配平的；无法构造返回 null）----
// 有交易流水：按流水方向；无流水：用存入日本金做单段估算。
// 终值口径与 Dashboard 一致：持有中 = 本金 + 已计提收益；已完结 = 本金 + 到期利息。
function buildItemFlows(
    item: Investment,
    toAmount: (amount: number, currency: Currency) => number
): CashFlow[] | null {
    const flows: CashFlow[] = [];
    const txs = item.transactions || [];
    for (const tx of txs) {
        if (tx.type === 'Buy' || tx.type === 'Fee' || tx.type === 'Tax') {
            flows.push({ date: tx.date, amount: -toAmount(Math.abs(tx.amount), item.currency) });
        } else if (tx.type === 'Sell' || tx.type === 'Dividend' || tx.type === 'Interest') {
            flows.push({ date: tx.date, amount: toAmount(Math.abs(tx.amount), item.currency) });
        }
    }
    if (flows.length === 0) {
        // 无流水：必须有存入日才能估算，否则该笔跳过（避免只有终值导致失衡）
        if (!item.depositDate || !(item.currentPrincipal > 0)) return null;
        flows.push({ date: item.depositDate, amount: -toAmount(item.currentPrincipal, item.currency) });
    }
    if (item.withdrawalDate) {
        // 已完结：用存入/取出日期重建干净现金流。
        // 原因：恢复数据的流水与利息字段存在各种不一致（Sell 只记本金、totalRealizedProfit 可能已含利息等），
        // 逐项推断容易错。不如直接用 UI 显示的口径：投入=买入总额，收回=投入+到期收益(+返利)。
        // Floating 的多笔交易时点对 XIRR 有意义，保留流水；Fixed 通常只有一买一卖，重建更准。
        const m = calculateItemMetrics(item);
        if (item.type === 'Fixed') {
            const buySum = txs.filter(t => t.type === 'Buy').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
            const invested = buySum > 0 ? buySum : (item.totalCost > 0 ? item.totalCost : item.currentPrincipal);
            const profit = (m.baseInterest || 0) + (item.rebate || 0);
            flows.length = 0;
            if (invested > 0 && item.depositDate) {
                flows.push({ date: item.depositDate, amount: -toAmount(invested, item.currency) });
                flows.push({ date: item.withdrawalDate, amount: toAmount(Math.max(invested + profit, 0), item.currency) });
            }
        } else if (txs.length === 0) {
            // Floating 无流水：用本金估算
            if (!item.depositDate || !(item.currentPrincipal > 0)) return null;
            flows.push({ date: item.depositDate, amount: -toAmount(item.currentPrincipal, item.currency) });
            const terminal = item.currentPrincipal + (m.baseInterest || 0) + (item.rebate || 0);
            flows.push({ date: item.withdrawalDate, amount: toAmount(Math.max(terminal, 0), item.currency) });
        }
        // Floating 有流水：保留流水时点，盈亏已在 Sell 金额中，不需额外终值
    } else if (!item.withdrawalDate && item.currentPrincipal > 0) {
        const m = calculateItemMetrics(item);
        const terminal = item.currentPrincipal + (item.currentReturn || m.accruedReturn || 0);
        flows.push({ date: todayStr(), amount: toAmount(Math.max(terminal, 0), item.currency) });
    }
    return flows;
}

// 单笔持仓的 XIRR
export function calculateItemXIRR(item: Investment): number | null {
    const flows = buildItemFlows(item, (a) => a);
    if (!flows) return null;
    return calculateXIRR(flows);
}

// 组合 XIRR：汇总所有持仓的现金流（多币种按当前汇率折 CNY；XIRR 对统一直乘的汇率不敏感）
export function calculatePortfolioXIRR(items: Investment[], rates: ExchangeRates): number | null {
    const toCNY = (amount: number, currency: Currency) => {
        if (!currency || currency === 'CNY') return amount;
        const rate = rates[currency] || 1;
        return amount / rate;
    };
    const flows: CashFlow[] = [];
    for (const item of items) {
        const f = buildItemFlows(item, toCNY);
        if (f) flows.push(...f);
    }
    return calculateXIRR(flows);
}

// 强制触发Vercel重新构建
