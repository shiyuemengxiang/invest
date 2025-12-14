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
    const todayISO = new Date().toISOString().split('T')[0];
    if (item.withdrawalDate) return 0;

    let dailyUnrealized = 0;
    const activePrincipal = item.currentPrincipal; 

    const isBoughtToday = todayISO === item.depositDate;

    if (isBoughtToday) {
        if (item.type === 'Floating') {
             dailyUnrealized = item.currentReturn || 0;
        } else if (item.type === 'Fixed') {
             const basis = Number(item.interestBasis || 365);
             dailyUnrealized = activePrincipal * ((item.expectedRate || 0) / 100) / basis;
        }
    } else {
        // 🔥 核心修正: 如果当前持仓为0 (已清仓未归档)，不应产生市值波动的盈亏
        if (item.type === 'Floating') {
            if (item.currentQuantity && item.currentQuantity > 0 && item.estGrowth && activePrincipal > 0) {
                const currentTotalValue = activePrincipal + (item.currentReturn || 0);
                const rate = item.estGrowth / 100;
                if (rate !== -1) {
                    dailyUnrealized = currentTotalValue * (rate / (1 + rate));
                }
            }
        } else if (item.type === 'Fixed' && item.expectedRate) {
            const basis = Number(item.interestBasis || 365);
            dailyUnrealized = activePrincipal * (item.expectedRate / 100) / basis;
        }
    }

    let dailyRealized = 0;
    if (item.transactions) {
        item.transactions.forEach(tx => {
            const txDate = tx.date.split('T')[0];
            if (txDate === todayISO) {
                if (tx.type === 'Dividend' || tx.type === 'Interest') {
                    dailyRealized += tx.amount;
                } else if (tx.type === 'Fee' || tx.type === 'Tax') {
                    dailyRealized -= tx.amount;
                }
            }
        });
    }

    return dailyUnrealized + dailyRealized;
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
  let totalCapitalWACC = 0;
  let weightedYieldSum = 0;
  let totalWeight = 0;
  const todayISO = new Date().toISOString().split('T')[0];

  items.forEach(item => {
    const metrics = calculateItemMetrics(item);
    totalInvested += item.totalCost; 
    totalRebate += item.rebate;
    const holdingDays = metrics.isCompleted 
        ? getDaysDiff(item.depositDate, item.withdrawalDate) 
        : getDaysDiff(item.depositDate, new Date().toISOString().split('T')[0]);
    const capitalBase = item.totalCost;
    if (holdingDays > 0 && capitalBase > 0) {
        totalCapitalWACC += capitalBase * holdingDays;
    }

    let itemRealized = 0;
    if (metrics.isCompleted) {
        itemRealized = metrics.baseInterest;
    } else {
        itemRealized = item.totalRealizedProfit;
    }
    realizedInterest += itemRealized;

    let itemUnrealized = 0;
    if (!metrics.isCompleted) {
        if (item.type === 'Fixed') {
            itemUnrealized = metrics.accruedReturn;
        } else {
            // 🔥🔥 核心修复点：解决双重计算 🔥🔥
            // 如果是浮动资产且已清仓(qty<=0)，即使没完结(Active)，浮盈也必须为0
            // 否则会叠加 (Realized Loss) + (Current Return Loss) = Double Loss
            if (item.type === 'Floating' && (!item.currentQuantity || item.currentQuantity <= 0)) {
                itemUnrealized = 0;
            } else {
                itemUnrealized = item.currentReturn || 0;
            }
        }
    }
    const itemRebateReceived = item.isRebateReceived ? item.rebate : 0;
    projectedTotalProfit += (itemRealized + itemUnrealized + itemRebateReceived);

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

    if (item.isRebateReceived) receivedRebate += item.rebate;
    else pendingRebate += item.rebate;

    if (metrics.isCompleted) {
        completedPrincipal += item.totalCost;
    } else {
        activePrincipal += item.currentPrincipal;
    }

    if (!metrics.isPending && (metrics.hasYieldInfo || item.rebate > 0)) { 
         const weight = (metrics.isCompleted || item.type === 'Floating') ? item.totalCost : item.currentPrincipal;
         if (weight > 0) {
             weightedYieldSum += metrics.comprehensiveYield * weight;
             totalWeight += weight;
         }
    }
  });

  let portfolioYield = 0;
  if (totalCapitalWACC > 0) {
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
    realizedInterest, 
    projectedTotalProfit,
    projectedTotalYield,
    todayEstProfit,
    comprehensiveYield: portfolioYield,
    totalCapitalWACC
  };
};

export const calculatePeriodStats = (items: Investment[], start: Date, end: Date) => {
    let totalInvested = 0; 
    let periodProfit = 0;
    let realizedInPeriod = 0;
    let totalCapitalWACC = 0; 
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

        const capitalBase = item.totalCost; 
        if (overlapDays > 0 && capitalBase > 0) {
             totalCapitalWACC += capitalBase * overlapDays;
        }

        let itemPeriodProfit = 0;
        const calculationPrincipal = item.currentPrincipal > 0.01 ? item.currentPrincipal : item.totalCost;
        let fixedInterestProjection = 0;

        if (item.type === 'Fixed' && item.expectedRate && calculationPrincipal > 0) {
            const basis = Number(item.interestBasis || 365);
            fixedInterestProjection = calculationPrincipal * (item.expectedRate / 100) * (overlapDays / basis);
            itemPeriodProfit += fixedInterestProjection;
        }

        const isCompletedInPeriod = withdrawalDate && withdrawalDate >= start && withdrawalDate <= end;
        
        if (isCompletedInPeriod) {
            const metrics = calculateItemMetrics(item);
            let netCompletionGain = metrics.baseInterest; 
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
            if (item.isRebateReceived && new Date(item.depositDate) < start) {
                realizedPnlTxBeforePeriod += item.rebate;
            }
            const completionNetProfit = netCompletionGain - realizedPnlTxBeforePeriod;
            realizedInPeriod += completionNetProfit;
            if (item.type === 'Fixed') {
                itemPeriodProfit = itemPeriodProfit - fixedInterestProjection + completionNetProfit;
            } else {
                itemPeriodProfit += completionNetProfit;
            }
        }
        
        if (isBetween(item.depositDate)) {
            totalRebate += item.rebate;
            itemPeriodProfit += item.rebate;
            if (item.isRebateReceived) {
                receivedRebate += item.rebate;
            } else {
                pendingRebate += item.rebate;
            }
        }

        if (item.transactions) {
            item.transactions.forEach(tx => {
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
        const weight = calculationPrincipal;
        totalInvested += weight;
    });

    let portfolioYield = 0;
    if (totalCapitalWACC > 0) {
        portfolioYield = (periodProfit / totalCapitalWACC) * 365 * 100;
    }

    return {
        projectedTotalProfit: periodProfit,
        realizedInterest: realizedInPeriod,
        activePrincipal: totalInvested,
        comprehensiveYield: portfolioYield,
        totalInvested: totalInvested,
        completedPrincipal: 0,
        totalRebate: totalRebate, 
        pendingRebate: pendingRebate, 
        receivedRebate: receivedRebate,
        projectedTotalYield: 0,
        todayEstProfit: 0,
        totalCapitalWACC: totalCapitalWACC
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
  const interestBasis = Number(item.interestBasis || 365);

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
      
      // 🟢 修复: 浮动资产完结逻辑 - 支持"手动最终收益"作为兜底
      if (item.type === 'Floating') {
           if (item.totalRealizedProfit !== 0) {
               baseInterest = item.totalRealizedProfit;
           } else if (item.currentReturn !== undefined && item.currentReturn !== 0) {
               baseInterest = item.currentReturn;
           } else {
               baseInterest = 0;
           }
      } else {
          const fixedInterest = item.expectedRate && item.totalCost > 0 
              ? item.totalCost * (item.expectedRate / 100) * (realDurationDays / interestBasis)
              : 0;
          baseInterest = item.totalRealizedProfit !== 0 ? item.totalRealizedProfit : fixedInterest;
      }
      
      const finalGain = baseInterest + (item.isRebateReceived ? item.rebate : 0);
      const calcBase = item.totalCost > 0 ? item.totalCost : 1; 
      
      if (calcBase > 0) {
        holdingYield = (finalGain / calcBase) * 100;
        if (realDurationDays > 0) {
            annualizedYield = (holdingYield / (realDurationDays / 365));
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
              const nextTx = sortedTxs[i+1];
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

      accruedReturn = calculateSegmentedInterest(now);
      if (maturity) baseInterest = calculateSegmentedInterest(maturity);
      if (activePrincipal > 0 && maturity) holdingYield = (baseInterest / activePrincipal) * 100;

  } else if (item.type === 'Floating') {
      if (item.currentReturn !== undefined) {
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
       comprehensiveYield = (gainForYield / yieldBase) * 100 / (realDurationDays / 365);
  } else if (isPending && item.type === 'Fixed' && item.expectedRate) {
      comprehensiveYield = item.expectedRate; 
  }

  // 🟢 修复 2: 成本价与现价计算 (兼容已完结状态)
  let unitCost = 0;
  let currentPrice = 0;
  const calcQuantity = isCompleted ? (item.quantity || 0) : (item.currentQuantity || 0);
  const calcPrincipal = isCompleted ? item.totalCost : activePrincipal;

  if (calcQuantity > 0) {
       unitCost = calcPrincipal / calcQuantity;
       const profitValue = isCompleted ? baseInterest : (item.currentReturn || accruedReturn);
       // 如果是未完结的浮动资产，现价还需要加上已实现的盈亏部分来反推
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
                 if (item.currentReturn !== undefined) {
                     value += item.currentReturn;
                 }
            }
            value += item.totalRealizedProfit; 
        }
        totalValuation += convertCurrency(value, item.currency, targetCurrency, rates);
    });
    return totalValuation;
};