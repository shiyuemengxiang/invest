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
    
    // Projected Total Profit (MWR Numerator): Accrued Profit + Received Rebate + Realized Tx P&L
    let currentProfitSum = 0;
    if (!metrics.isCompleted && !metrics.isPending && item.type === 'Fixed') {
        currentProfitSum = metrics.accruedReturn; // Use accrued for fixed active
    } else if (metrics.type === 'Floating') {
        currentProfitSum = metrics.baseInterest; // Use baseInterest (currentReturn + realized txs)
    } else {
        currentProfitSum = metrics.baseInterest; // Use baseInterest (fixed interest + realized txs)
    }
    
    currentProfitSum += (item.isRebateReceived ? item.rebate : 0); // Add only RECEIVED rebate
    currentProfitSum += item.totalRealizedProfit; // Add realized transaction P&L
    
    projectedTotalProfit += currentProfitSum;

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
  // 🔥 核心修复点：将 "已到账返利" 累加到 "总已落袋收益" 中,
  // -------------------------------------------------------------
  // 错误：返利不应混入已结盈亏
//   realizedInterest += receivedRebate;

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
  const todayStart = new Date().setHours(0,0,0,0);
  const deposit = new Date(item.depositDate);
  const depositStart = new Date(item.depositDate).setHours(0,0,0,0);
  const maturity = item.maturityDate ? new Date(item.maturityDate) : null;
  const withdrawal = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
  const isCompleted = !!item.withdrawalDate;
  const isPending = todayStart < depositStart;

  const activePrincipal = item.currentPrincipal; 
  const currentQuantity = item.currentQuantity || 0;
  
  const interestBasis = Number(item.interestBasis || '365');

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
  
  // 核心天数计算：计息天数 (Accrual Days) 和 持有天数 (Holding Days)
  // Fixed interest accrual period (Deposit -> Maturity)
  const durationForAccrual = item.type === 'Fixed' && maturity ? getDaysDiff(item.depositDate, item.maturityDate) : 0;
  // Actual holding period for yield annualization (Deposit -> Withdrawal/Today)
  const durationForAnnualization = isCompleted ? getDaysDiff(item.depositDate, item.withdrawalDate) : realDurationDays;
  
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
      
      // 1. Fixed Interest Calculation (using Maturity days)
      const fixedInterest = item.type === 'Fixed' && item.expectedRate && item.totalCost > 0 && durationForAccrual > 0
          ? item.totalCost * (item.expectedRate / 100) * (durationForAccrual / interestBasis) 
          : 0;
      
      // 2. Determine final net product P&L (baseInterest)
      // FIX: Prefer item.currentReturn (manual final P&L) if set for Floating. 
      if (item.currentReturn !== undefined && item.type === 'Floating') {
          // Use manual final profit/loss (which is -814.64 in the user example)
          baseInterest = item.currentReturn + item.totalRealizedProfit;
      } else {
          // Fixed or Floating w/o manual final P&L: rely on fixed interest accrual + transaction sum
          baseInterest = fixedInterest + item.totalRealizedProfit;
      }
      
      const calcBase = item.totalCost > 0 ? item.totalCost : 1; 
      if (calcBase > 0 && baseInterest !== 0) {
        holdingYield = (baseInterest / calcBase) * 100;
        // 修正 实测年化 公式: 使用 item.interestBasis 作为年化基准
        if (durationForAnnualization > 0) {
            annualizedYield = (holdingYield / (durationForAnnualization / interestBasis));
        }
      }

  } else if (item.type === 'Fixed' && item.expectedRate) {
      // --- REVISED FIXED ACTIVE ACCRUAL LOGIC ---
      const rate = item.expectedRate;
      const daysInYear = Number(item.interestBasis || 365);
      
      // 1. Total Expected Profit (Full Term) - 用于 '截止到期预估收益'
      baseInterest = durationForAccrual > 0 ? (activePrincipal * (rate / 100) * (durationForAccrual / daysInYear)) : 0;
      
      // 2. Accrued Profit (Up to Today) - 用于 '截止今日预估'
      const accrualDays = getDaysDiff(item.depositDate, now.toISOString().split('T')[0]);
      accruedReturn = accrualDays > 0 ? (activePrincipal * (rate / 100) * (accrualDays / daysInYear)) : 0;

      // Yield calculation uses the total expected rate/return for comparison
      if (activePrincipal > 0) {
          holdingYield = (baseInterest / activePrincipal) * 100;
          if (durationForAccrual > 0) {
             annualizedYield = rate;
          }
      } else {
          hasYieldInfo = false;
      }

  } else if (item.type === 'Floating') {
      
      // FIX: Consolidate P&L calculation to run if total realized or unrealized profit exists.
      const currentReturn = item.currentReturn !== undefined ? item.currentReturn : 0;
      const totalPnl = currentReturn + item.totalRealizedProfit;

      if (totalPnl !== 0 || item.expectedRate) { 
          hasYieldInfo = true;
          const costBasis = item.totalCost > 0 ? item.totalCost : item.principal > 0 ? item.principal : activePrincipal;
          
          if (item.expectedRate) {
              // Case 2 Logic: Use expected rate for projection
              const rate = item.expectedRate;
              annualizedYield = rate;
              baseInterest = activePrincipal * (rate / 100) * (realDurationDays / 365);
              if (activePrincipal > 0) holdingYield = (baseInterest / activePrincipal) * 100;

          } else {
              // Case 1 & 3 Logic: Use actual P&L to derive yield (FIXES THE USER SCENARIO)
              baseInterest = totalPnl; 
              
              if (costBasis > 0) {
                  holdingYield = (baseInterest / costBasis) * 100;
                  if (realDurationDays > 0) {
                      annualizedYield = (holdingYield / (realDurationDays / 365));
                  }
              }
          }
          
      } else {
          hasYieldInfo = false;
      }
  } else {
      hasYieldInfo = false;
  }
  
//   const totalReturn = baseInterest + item.rebate + item.totalRealizedProfit; 
// remove rebate     
const totalReturn = baseInterest  + item.totalRealizedProfit; 

  
  let comprehensiveYield = 0;
  const yieldBase = isCompleted || item.type === 'Floating' ? item.totalCost : activePrincipal;
  const finalGain = baseInterest + (item.isRebateReceived ? item.rebate : 0); // Total Net Profit + Received Rebate (For COMPLETED calculation)


  if (!isPending && (hasYieldInfo || item.rebate > 0) && durationForAnnualization > 0 && yieldBase > 0) {
      if (item.type === 'Fixed' && !isCompleted && item.expectedRate) {
          const rebateYield = (item.rebate / yieldBase) * 100 / (realDurationDays / 365);
          comprehensiveYield = item.expectedRate + rebateYield;
      } else if (isCompleted) {
          // 修正 实测年化 公式: 使用 item.interestBasis 作为年化基准， durationForAnnualization (取出时间-存入时间) 作为持有时间
          const holdingYield = (finalGain / yieldBase) * 100;
          comprehensiveYield = holdingYield * (interestBasis / durationForAnnualization);
      } else {
          const yieldVal = (totalReturn / yieldBase) * 100;
          comprehensiveYield = yieldVal * (interestBasis / durationForAnnualization);
      }
  } else if (isPending && item.type === 'Fixed' && item.expectedRate) {
      comprehensiveYield = item.expectedRate; 
  }

  const profit = totalReturn; 
  
  let unitCost = 0;
  let currentPrice = 0;
  if (currentQuantity && currentQuantity > 0) {
      unitCost = activePrincipal / currentQuantity;
      const currentTotalValue = activePrincipal + (isCompleted ? baseInterest : (item.currentReturn || accruedReturn)) + (item.type === 'Floating' ? item.totalRealizedProfit : 0);
      currentPrice = currentTotalValue / currentQuantity;
  }

  return {
    interestDays: realDurationDays,
    baseInterest, 
    totalReturn,
    profit,
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