
import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption } from './types';

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

// Theme Configuration Map
export const THEMES: Record<ThemeOption, ThemeConfig> = {
    // --- Dark Themes ---
    slate: {
        sidebar: 'bg-slate-900 text-slate-300',
        accent: 'from-slate-700 to-slate-900',
        button: 'bg-slate-900 hover:bg-slate-800',
        text: 'text-slate-600',
        icon: 'text-slate-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    midnight: {
        sidebar: 'bg-black text-gray-400',
        accent: 'from-gray-800 to-black',
        button: 'bg-black hover:bg-gray-900',
        text: 'text-gray-600',
        icon: 'text-gray-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    ocean: {
        sidebar: 'bg-blue-900 text-blue-200',
        accent: 'from-blue-600 to-blue-800',
        button: 'bg-blue-600 hover:bg-blue-700',
        text: 'text-blue-600',
        icon: 'text-blue-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    forest: {
        sidebar: 'bg-emerald-900 text-emerald-100',
        accent: 'from-emerald-600 to-emerald-800',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        text: 'text-emerald-600',
        icon: 'text-emerald-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    sunset: {
        sidebar: 'bg-rose-900 text-rose-100',
        accent: 'from-rose-600 to-rose-800',
        button: 'bg-rose-600 hover:bg-rose-700',
        text: 'text-rose-600',
        icon: 'text-rose-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    royal: {
        sidebar: 'bg-indigo-950 text-indigo-100',
        accent: 'from-indigo-600 to-purple-800',
        button: 'bg-indigo-700 hover:bg-indigo-800',
        text: 'text-indigo-700',
        icon: 'text-indigo-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    teal: {
        sidebar: 'bg-teal-900 text-teal-100',
        accent: 'from-teal-600 to-cyan-800',
        button: 'bg-teal-700 hover:bg-teal-800',
        text: 'text-teal-700',
        icon: 'text-teal-500',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    amber: {
        sidebar: 'bg-amber-950 text-amber-100',
        accent: 'from-amber-500 to-orange-700',
        button: 'bg-amber-700 hover:bg-amber-800',
        text: 'text-amber-700',
        icon: 'text-amber-500',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    crimson: {
        sidebar: 'bg-red-950 text-red-100',
        accent: 'from-red-700 to-red-900',
        button: 'bg-red-800 hover:bg-red-900',
        text: 'text-red-800',
        icon: 'text-red-500',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    pink: {
        sidebar: 'bg-fuchsia-900 text-fuchsia-100',
        accent: 'from-fuchsia-500 to-pink-700',
        button: 'bg-fuchsia-700 hover:bg-fuchsia-800',
        text: 'text-fuchsia-700',
        icon: 'text-fuchsia-400',
        navActive: 'bg-white/10 text-white font-bold',
        navHover: 'hover:bg-white/5 opacity-80'
    },
    
    // --- Light Themes ---
    lavender: {
        sidebar: 'bg-violet-50 text-violet-900 border-r border-violet-100',
        accent: 'from-violet-400 to-violet-600',
        button: 'bg-violet-500 hover:bg-violet-600',
        text: 'text-violet-600',
        icon: 'text-violet-400',
        navActive: 'bg-violet-200 text-violet-900 font-bold shadow-sm',
        navHover: 'hover:bg-violet-100 text-violet-700'
    },
    mint: {
        sidebar: 'bg-emerald-50 text-emerald-900 border-r border-emerald-100',
        accent: 'from-emerald-400 to-teal-500',
        button: 'bg-emerald-500 hover:bg-emerald-600',
        text: 'text-emerald-600',
        icon: 'text-emerald-500',
        navActive: 'bg-emerald-200 text-emerald-900 font-bold shadow-sm',
        navHover: 'hover:bg-emerald-100 text-emerald-700'
    },
    sky: {
        sidebar: 'bg-sky-50 text-sky-900 border-r border-sky-100',
        accent: 'from-sky-400 to-blue-500',
        button: 'bg-sky-500 hover:bg-sky-600',
        text: 'text-sky-600',
        icon: 'text-sky-500',
        navActive: 'bg-sky-200 text-sky-900 font-bold shadow-sm',
        navHover: 'hover:bg-sky-100 text-sky-700'
    },
    sakura: {
        sidebar: 'bg-pink-50 text-pink-900 border-r border-pink-100',
        accent: 'from-pink-400 to-rose-500',
        button: 'bg-pink-500 hover:bg-pink-600',
        text: 'text-pink-600',
        icon: 'text-pink-400',
        navActive: 'bg-pink-200 text-pink-900 font-bold shadow-sm',
        navHover: 'hover:bg-pink-100 text-pink-700'
    },
    ivory: {
        sidebar: 'bg-white text-slate-800 border-r border-slate-200',
        accent: 'from-slate-400 to-slate-600',
        button: 'bg-slate-700 hover:bg-slate-800',
        text: 'text-slate-700',
        icon: 'text-slate-400',
        navActive: 'bg-slate-100 text-slate-900 font-bold shadow-sm',
        navHover: 'hover:bg-slate-50 text-slate-600'
    }
};

export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

// Convert any amount from source currency to target currency using DYNAMIC rates
export const convertCurrency = (amount: number, from: Currency, to: Currency, rates: ExchangeRates): number => {
    if (from === to) return amount;
    // Convert to CNY base then to target
    const inCNY = amount * rates[from];
    return inCNY / rates[to];
};

// Calculate metrics for a single investment
export const calculateItemMetrics = (item: Investment) => {
  const now = new Date();
  // Reset time part for date-only comparison
  const todayStart = new Date().setHours(0,0,0,0);
  
  const deposit = new Date(item.depositDate);
  const depositStart = new Date(item.depositDate).setHours(0,0,0,0);

  const maturity = item.maturityDate ? new Date(item.maturityDate) : null;
  const withdrawal = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
  const isCompleted = !!item.withdrawalDate;

  // New Status Logic: Pending Entry (未入金) if Today < Deposit Date
  const isPending = todayStart < depositStart;

  // Determine Duration
  // If Pending: Duration is 0
  // If Completed: Withdrawal - Deposit
  // If Active: Now - Deposit
  // (Assuming Fixed estimated yield calculation uses full term Maturity - Deposit elsewhere)
  
  let occupiedDurationMs = 0;
  
  if (!isPending) {
      if (isCompleted && withdrawal) {
          occupiedDurationMs = withdrawal.getTime() - deposit.getTime();
      } else {
          // For active items, duration is time held so far
          occupiedDurationMs = now.getTime() - deposit.getTime();
      }
  }

  // Ensure non-negative duration
  occupiedDurationMs = Math.max(0, occupiedDurationMs);
  
  // Real Duration in Days (min 0)
  // Used for annualized calculation. 
  // If duration is 0 (Pending or Same Day), we handle division by zero later
  const realDurationDays = Math.round(occupiedDurationMs / MS_PER_DAY);
  
  let baseInterest = 0;
  let annualizedYield = 0; // The Year-over-Year %
  let holdingYield = 0; // The Absolute Return %
  let hasYieldInfo = true;
  let accruedReturn = 0; // Est. return as of TODAY for fixed items

  if (isPending) {
      // Pending state: No returns calculated yet
      hasYieldInfo = true; // Show expected if available
      if (item.type === 'Fixed' && item.expectedRate) {
           annualizedYield = item.expectedRate;
      }
      // Everything else 0
  } else if (isCompleted && item.realizedReturn !== undefined) {
      // 1. Completed Item (Realized)
      // Strict calculation based on Realized Return and Actual Duration (Withdrawal - Deposit)
      baseInterest = item.realizedReturn;
      if (item.principal > 0) {
        holdingYield = (baseInterest / item.principal) * 100;
        if (realDurationDays > 0) {
            annualizedYield = (holdingYield / (realDurationDays / 365));
        }
      }

  } else if (item.type === 'Fixed' && item.expectedRate) {
      // 2. Fixed Income with Rate (Active)
      // Display as "Expected Annualized"
      // Duration used for projection: Maturity - Deposit
      const rate = item.expectedRate;
      annualizedYield = rate;
      
      // Calculate Projected Total Earnings at Maturity
      // Only if Maturity is set
      if (maturity) {
          const fullTermMs = maturity.getTime() - deposit.getTime();
          const fullTermDays = Math.max(1, Math.round(fullTermMs / MS_PER_DAY));
          baseInterest = item.principal * (rate / 100) * (fullTermDays / 365);
      }
      
      // Calculate Accrued Interest (As of Today)
      // Duration So Far: Today - Deposit (Already in realDurationDays)
      accruedReturn = item.principal * (rate / 100) * (realDurationDays / 365);
      
      if (item.principal > 0 && maturity) {
         holdingYield = (baseInterest / item.principal) * 100; // Projected absolute return at maturity
      }

  } else if (item.type === 'Floating') {
      // 3. Floating / Non-Fixed
      if (item.currentReturn !== undefined) {
          // Manually entered current return (Active)
          baseInterest = item.currentReturn;
          if (item.principal > 0) {
            holdingYield = (baseInterest / item.principal) * 100;
            
            // Extrapolate annualized (Current Return / Current Duration * 365)
            if (realDurationDays > 0) {
                annualizedYield = (holdingYield / (realDurationDays / 365));
            }
          }
      } else if (item.expectedRate) {
           // Treated as estimate if no current return entered
           const rate = item.expectedRate;
           annualizedYield = rate;
           // Estimate accrued based on duration so far
           baseInterest = item.principal * (rate / 100) * (realDurationDays / 365);
           if (item.principal > 0) holdingYield = (baseInterest / item.principal) * 100;
      } else {
          hasYieldInfo = false;
          baseInterest = 0;
          annualizedYield = 0;
          holdingYield = 0;
      }
  } else {
      // Fallback
      hasYieldInfo = false;
      baseInterest = 0;
      annualizedYield = 0;
      holdingYield = 0;
  }
  
  const totalReturn = baseInterest + item.rebate;

  // Comprehensive Yield is the "Annualized Total Return" including Rebates
  let comprehensiveYield = 0;
  if (!isPending && (hasYieldInfo || item.rebate > 0) && realDurationDays > 0 && item.principal > 0) {
      const totalHoldingYield = (totalReturn / item.principal) * 100;
      comprehensiveYield = totalHoldingYield / (realDurationDays / 365);
  } else if (isPending && item.type === 'Fixed' && item.expectedRate) {
      // For pending fixed, we estimate comprehensive based on expected
      // This is rough because we don't know duration exactly if maturity missing, 
      // but usually fixed has expected rate.
      comprehensiveYield = item.expectedRate; // Base estimate
  }

  const profit = totalReturn; 
  
  // Unit Price Calculations (Funds/Stocks)
  let unitCost = 0;
  let currentPrice = 0;
  if (item.quantity && item.quantity > 0) {
      unitCost = item.principal / item.quantity;
      // Current Value = Principal + (Realized/Current Return) + Rebate
      // Note: Usually rebate is cash back, not part of NAV, but here we treat it as total return
      const currentTotalValue = item.principal + (isCompleted ? baseInterest : (item.currentReturn || accruedReturn));
      currentPrice = currentTotalValue / item.quantity;
  }

  return {
    interestDays: realDurationDays,
    baseInterest,
    totalReturn,
    profit,
    realDurationDays,
    annualizedYield,
    holdingYield, // Absolute %
    comprehensiveYield, // Annualized %
    accruedReturn, // New: Return as of today for Fixed Active
    isCompleted,
    isPending, // New Status
    hasYieldInfo,
    daysRemaining: item.maturityDate ? getDaysRemaining(item.maturityDate) : 0,
    unitCost, // New
    currentPrice // New
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
  let projectedTotalProfit = 0; // Accumulator for total profit (Realized + Projected)
  
  let weightedYieldSum = 0;
  let totalWeight = 0;

  items.forEach(item => {
    const metrics = calculateItemMetrics(item);
    
    totalInvested += item.principal;
    totalRebate += item.rebate;
    
    // Summing up total estimated profit from all sources
    // UPDATED LOGIC: For Active Fixed items, use Accrued (Current) Return instead of Full Maturity Return
    if (!metrics.isCompleted && !metrics.isPending && item.type === 'Fixed') {
        projectedTotalProfit += (metrics.accruedReturn + item.rebate);
    } else {
        // Floating (already current), Completed (realized), Pending (rebate only)
        projectedTotalProfit += metrics.profit;
    }

    if (item.isRebateReceived) {
      receivedRebate += item.rebate;
    } else {
      pendingRebate += item.rebate;
    }

    if (metrics.isCompleted) {
      completedPrincipal += item.principal;
      realizedInterest += metrics.baseInterest;
    } else {
      activePrincipal += item.principal;
    }

    // Only weight yields that make sense (exclude crazy outliers from short duration)
    // Exclude Pending items from yield calc as duration is 0
    if (!metrics.isPending && (metrics.hasYieldInfo || item.rebate > 0) && metrics.comprehensiveYield > -100 && metrics.comprehensiveYield < 1000) { 
        weightedYieldSum += metrics.comprehensiveYield * item.principal;
        totalWeight += item.principal;
    }
  });

  return {
    totalInvested,
    activePrincipal,
    completedPrincipal,
    totalRebate,
    pendingRebate,
    receivedRebate,
    realizedInterest,
    projectedTotalProfit,
    comprehensiveYield: totalWeight > 0 ? weightedYieldSum / totalWeight : 0
  };
};

// New Helper: Calculate Total Net Worth Value in Target Currency using DYNAMIC rates
export const calculateTotalValuation = (items: Investment[], targetCurrency: Currency, rates: ExchangeRates) => {
    let totalValuation = 0;

    items.forEach(item => {
        const metrics = calculateItemMetrics(item);
        
        let value = item.principal;

        if (metrics.isCompleted) {
            value += metrics.totalReturn;
        } else if (metrics.isPending) {
            value = item.principal; // Just the committed amount
        } else {
            // Active
            if (item.type === 'Fixed') {
                 // UPDATED LOGIC: Use Accrued Return for Fixed Active items to reflect current net worth
                 value += metrics.accruedReturn + item.rebate;
            } else {
                 // Floating items: metrics.totalReturn is already based on currentReturn or time-based accrual
                 if (metrics.hasYieldInfo || item.currentReturn) {
                    value += metrics.totalReturn; 
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
    // Use setHours to normalize today comparisons
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return items.filter(item => {
        // Fix: Ensure we parse the string YYYY-MM-DD correctly in local time context or consistently
        const d = new Date(item.depositDate); 
        // Normalize time to midnight for fair comparison
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
                    // Force start of day / end of day
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
