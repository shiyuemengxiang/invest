
import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption, Transaction } from './types';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ... [Theme Config remains unchanged, re-including for file completeness] ...
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
    ivory: { sidebar: 'bg-white text-slate-800 border-r border-slate-200', accent: 'from-slate-400 to-slate-600', button: 'bg-slate-700 hover:bg-slate-800', text: 'text-slate-700', icon: 'text-slate-400', navActive: 'bg-slate-100 text-slate-900 font-bold shadow-sm', navHover: 'hover:bg-slate-50 text-slate-600' }
};

// --- DATA MIGRATION & CALCULATION UTILS ---

/**
 * Ensures an investment object has the new Transaction structure.
 * Converts legacy snapshot data to transaction history.
 */
export const migrateInvestmentData = (item: any): Investment => {
    // If already has transactions, just return (maybe recalculate to be safe)
    if (item.transactions && Array.isArray(item.transactions) && item.transactions.length > 0) {
        return recalculateInvestmentState(item);
    }

    // Create Initial Buy Transaction from legacy fields
    const transactions: Transaction[] = [];
    
    // 1. Initial Deposit
    transactions.push({
        id: self.crypto.randomUUID(),
        date: item.depositDate,
        type: 'Buy',
        amount: Number(item.principal),
        quantity: item.quantity,
        price: item.quantity ? Number(item.principal) / Number(item.quantity) : undefined,
        notes: 'Initial Deposit (Migrated)'
    });

    // 2. Withdrawal (if exists) -> Sell Transaction
    if (item.withdrawalDate) {
        transactions.push({
            id: self.crypto.randomUUID(),
            date: item.withdrawalDate,
            type: 'Sell',
            amount: Number(item.principal), // Assuming full withdrawal in legacy model
            quantity: item.quantity, // Assuming full exit
            notes: 'Full Withdrawal (Migrated)'
        });
    }

    const newItem: Investment = {
        ...item,
        transactions,
        // Initialize computed fields (will be overwritten by recalculate)
        currentPrincipal: 0,
        totalCost: 0,
        totalRealizedProfit: 0,
        currentQuantity: 0
    };

    return recalculateInvestmentState(newItem);
};

/**
 * Re-runs the ledger of transactions to calculate current state.
 * Call this whenever a transaction is added/edited/removed.
 */
export const recalculateInvestmentState = (item: Investment): Investment => {
    let currentPrincipal = 0;
    let currentQuantity = 0;
    let totalCost = 0;
    let totalRealizedProfit = 0;

    // Sort transactions by date
    const sortedTxs = [...(item.transactions || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const tx of sortedTxs) {
        if (tx.type === 'Buy') {
            currentPrincipal += tx.amount;
            totalCost += tx.amount;
            if (tx.quantity) currentQuantity += tx.quantity;
        } else if (tx.type === 'Sell') {
            // Simple FIFO or Avg Cost logic is complex. 
            // For Phase 1: simple subtraction
            currentPrincipal -= tx.amount; 
            if (tx.quantity) currentQuantity -= tx.quantity;
            
        } else if (tx.type === 'Dividend') {
            totalRealizedProfit += tx.amount;
        }
    }

    // Prevent negative float errors
    currentPrincipal = Math.max(0, currentPrincipal);
    currentQuantity = Math.max(0, currentQuantity);

    return {
        ...item,
        transactions: sortedTxs,
        currentPrincipal,
        currentQuantity,
        totalCost,
        totalRealizedProfit, 
        principal: currentPrincipal, // Sync legacy field for UI compatibility
        quantity: currentQuantity    // Sync legacy field for UI compatibility
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

    // Use currentPrincipal (calculated from txs)
    const activePrincipal = item.currentPrincipal; 

    if (item.type === 'Floating') {
        if (item.estGrowth && activePrincipal > 0) {
            const currentTotalValue = activePrincipal + (item.currentReturn || 0);
            const baseValue = Math.max(0, currentTotalValue);
            return baseValue * (item.estGrowth / 100);
        }
        return 0;
    }

    if (item.type === 'Fixed' && item.expectedRate) {
        return activePrincipal * (item.expectedRate / 100) / 365;
    }

    return 0;
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

  // Use Computed Fields from Transactions
  const activePrincipal = item.currentPrincipal; 
  const currentQuantity = item.currentQuantity || 0;

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
  } else if (isCompleted && item.realizedReturn !== undefined) {
      // For completed, baseInterest implies Total Realized Gain
      baseInterest = item.realizedReturn + item.totalRealizedProfit; 
      
      const calcBase = item.totalCost > 0 ? item.totalCost : 1; 
      
      if (calcBase > 0) {
        holdingYield = (baseInterest / calcBase) * 100;
        if (realDurationDays > 0) {
            annualizedYield = (holdingYield / (realDurationDays / 365));
        }
      }

  } else if (item.type === 'Fixed' && item.expectedRate) {
      const rate = item.expectedRate;
      annualizedYield = rate;
      
      if (maturity) {
          const fullTermMs = maturity.getTime() - deposit.getTime();
          const fullTermDays = Math.max(1, Math.round(fullTermMs / MS_PER_DAY));
          baseInterest = activePrincipal * (rate / 100) * (fullTermDays / 365);
      }
      
      accruedReturn = activePrincipal * (rate / 100) * (realDurationDays / 365);
      
      if (activePrincipal > 0 && maturity) {
         holdingYield = (baseInterest / activePrincipal) * 100;
      }

  } else if (item.type === 'Floating') {
      if (item.currentReturn !== undefined) {
          // For floating, total return usually means unrealized P&L + realized dividends
          baseInterest = item.currentReturn; 
          const totalValueChange = item.currentReturn + item.totalRealizedProfit;
          
          if (activePrincipal > 0) {
            holdingYield = (totalValueChange / activePrincipal) * 100;
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
          hasYieldInfo = false;
      }
  } else {
      hasYieldInfo = false;
  }
  
  // Total Return displayed in UI: Base Interest + Rebate
  // For completed: (Realized Gain + Dividends) + Rebate
  // For Fixed Active: (Maturity Interest) + Rebate  [Note: this is projected]
  // For Floating Active: (Unrealized P&L) + Rebate [Note: we typically add realized dividends to holding yield but maybe not to 'totalReturn' if that means 'unrealized']
  // Let's standardize: totalReturn = Value Gain + Cash Received
  const totalReturn = baseInterest + item.rebate + (!isCompleted && item.type === 'Floating' ? item.totalRealizedProfit : 0);
  
  let comprehensiveYield = 0;
  const yieldBase = isCompleted ? item.totalCost : activePrincipal;

  if (!isPending && (hasYieldInfo || item.rebate > 0) && realDurationDays > 0 && yieldBase > 0) {
      if (item.type === 'Fixed' && !isCompleted && item.expectedRate) {
          const rebateYield = (item.rebate / yieldBase) * 100 / (realDurationDays / 365);
          comprehensiveYield = item.expectedRate + rebateYield;
      } else {
          // Re-calc yield based on total return
          const yieldVal = (totalReturn / yieldBase) * 100;
          comprehensiveYield = yieldVal / (realDurationDays / 365);
      }
  } else if (isPending && item.type === 'Fixed' && item.expectedRate) {
      comprehensiveYield = item.expectedRate; 
  }

  const profit = totalReturn; 
  
  let unitCost = 0;
  let currentPrice = 0;
  if (currentQuantity && currentQuantity > 0) {
      unitCost = activePrincipal / currentQuantity;
      const currentTotalValue = activePrincipal + (isCompleted ? baseInterest : (item.currentReturn || accruedReturn));
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
  
  let weightedYieldSum = 0;
  let totalWeight = 0;

  items.forEach(item => {
    const metrics = calculateItemMetrics(item);
    
    totalInvested += item.totalCost; 
    totalRebate += item.rebate;
    
    // 1. Projected/Total Profit Calculation
    if (!metrics.isCompleted && !metrics.isPending && item.type === 'Fixed') {
        // For Active Fixed: Accrued Interest + Rebate + Realized Dividends
        projectedTotalProfit += (metrics.accruedReturn + item.rebate + item.totalRealizedProfit);
    } else if (!metrics.isCompleted && item.type === 'Floating') {
        // For Active Floating: Unrealized P&L + Rebate + Realized Dividends
        // metrics.profit currently includes currentReturn + rebate + totalRealizedProfit (via update above)
        projectedTotalProfit += metrics.profit;
    } else {
        // Completed: Total Profit
        projectedTotalProfit += metrics.profit;
    }
    
    if (!metrics.isCompleted) {
        todayEstProfit += calculateDailyReturn(item);
    }

    if (item.isRebateReceived) {
      receivedRebate += item.rebate;
    } else {
      pendingRebate += item.rebate;
    }

    // 2. Realized Interest (Pocketed) Calculation
    if (metrics.isCompleted) {
      completedPrincipal += item.totalCost;
      realizedInterest += metrics.baseInterest; // Base Interest includes Realized Return + Total Dividends
    } else {
      activePrincipal += item.currentPrincipal;
      // CRITICAL FIX: Add dividends from ACTIVE investments to Realized Interest
      realizedInterest += item.totalRealizedProfit;
    }

    if (!metrics.isPending && (metrics.hasYieldInfo || item.rebate > 0) && metrics.comprehensiveYield > -100 && metrics.comprehensiveYield < 1000) { 
        const weight = metrics.isCompleted ? item.totalCost : item.currentPrincipal;
        weightedYieldSum += metrics.comprehensiveYield * weight;
        totalWeight += weight;
    }
  });
  
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
    comprehensiveYield: totalWeight > 0 ? weightedYieldSum / totalWeight : 0
  };
};

// ... [calculateTotalValuation, filterInvestmentsByTime, formatCurrency, formatPercent remain unchanged] ...
export const calculateTotalValuation = (items: Investment[], targetCurrency: Currency, rates: ExchangeRates) => {
    let totalValuation = 0;

    items.forEach(item => {
        const metrics = calculateItemMetrics(item);
        let value = item.currentPrincipal; // Start with active principal

        if (metrics.isCompleted) {
            value += metrics.totalReturn;
        } else if (metrics.isPending) {
            value = item.currentPrincipal; 
        } else {
            if (item.type === 'Fixed') {
                 // For valuation: Principal + Accrued + Rebate + Dividends(Cash out? No, Valuation usually means current asset value)
                 // If Dividends are "Cash Out", they are not part of the current asset value held.
                 // But they are part of Net Worth if we consider them in a cash account.
                 // Since we don't track a separate cash account, we add them to Total Worth for now.
                 value += metrics.accruedReturn + item.rebate + item.totalRealizedProfit;
            } else {
                 if (metrics.hasYieldInfo || item.currentReturn) {
                    value += metrics.totalReturn; // totalReturn now includes dividends for floating
                 } else {
                    value += item.rebate;
                 }
            }
        }
        totalValuation += convertCurrency(value, item.currency, targetCurrency, rates);
    });

    return totalValuation;
};

export const filterInvestmentsByTime = (items: Investment[], filter: TimeFilter, customStart?: string, customEnd?: string): Investment[] => {
    if (filter === 'all') return items;
    const now = new Date();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return items.filter(item => {
        const d = new Date(item.depositDate); 
        d.setHours(0,0,0,0);
        switch (filter) {
            case '1m': return d >= new Date(new Date().setMonth(now.getMonth() - 1));
            case '3m': return d >= new Date(new Date().setMonth(now.getMonth() - 3));
            case '6m': return d >= new Date(new Date().setMonth(now.getMonth() - 6));
            case '1y': return d >= new Date(new Date().setFullYear(now.getFullYear() - 1));
            case 'mtd': return d >= new Date(now.getFullYear(), now.getMonth(), 1);
            case 'ytd': return d >= new Date(now.getFullYear(), 0, 1);
            case 'custom': 
                if (customStart && customEnd) {
                    const start = new Date(customStart);
                    start.setHours(0,0,0,0);
                    const end = new Date(customEnd);
                    end.setHours(23,59,59,999);
                    return d >= start && d <= end;
                }
                return true;
            default: return true;
        }
    });
};

export const formatCurrency = (val: number, currency: Currency = 'CNY') => {
  const currencyCode = currency === 'CNY' ? 'CNY' : currency === 'USD' ? 'USD' : 'HKD';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currencyCode }).format(val);
};

export const formatPercent = (val: number) => {
  if (!isFinite(val) || isNaN(val)) return '-';
  return `${val.toFixed(2)}%`;
};
