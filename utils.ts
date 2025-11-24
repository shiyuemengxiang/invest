

import { Currency, ExchangeRates, Investment, TimeFilter, ThemeOption } from './types';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Theme Configuration Map
export const THEMES: Record<ThemeOption, { sidebar: string, accent: string, button: string, text: string, icon: string }> = {
    slate: {
        sidebar: 'bg-slate-900 text-slate-300',
        accent: 'from-slate-700 to-slate-900',
        button: 'bg-slate-900 hover:bg-slate-800',
        text: 'text-slate-600',
        icon: 'text-slate-400'
    },
    midnight: {
        sidebar: 'bg-black text-gray-400',
        accent: 'from-gray-800 to-black',
        button: 'bg-black hover:bg-gray-900',
        text: 'text-gray-600',
        icon: 'text-gray-400'
    },
    ocean: {
        sidebar: 'bg-blue-900 text-blue-200',
        accent: 'from-blue-600 to-blue-800',
        button: 'bg-blue-600 hover:bg-blue-700',
        text: 'text-blue-600',
        icon: 'text-blue-400'
    },
    forest: {
        sidebar: 'bg-emerald-900 text-emerald-100',
        accent: 'from-emerald-600 to-emerald-800',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        text: 'text-emerald-600',
        icon: 'text-emerald-400'
    },
    sunset: {
        sidebar: 'bg-rose-900 text-rose-100',
        accent: 'from-rose-600 to-rose-800',
        button: 'bg-rose-600 hover:bg-rose-700',
        text: 'text-rose-600',
        icon: 'text-rose-400'
    },
    royal: {
        sidebar: 'bg-indigo-950 text-indigo-100',
        accent: 'from-indigo-600 to-purple-800',
        button: 'bg-indigo-700 hover:bg-indigo-800',
        text: 'text-indigo-700',
        icon: 'text-indigo-400'
    },
    teal: {
        sidebar: 'bg-teal-900 text-teal-100',
        accent: 'from-teal-600 to-cyan-800',
        button: 'bg-teal-700 hover:bg-teal-800',
        text: 'text-teal-700',
        icon: 'text-teal-500'
    },
    amber: {
        sidebar: 'bg-amber-950 text-amber-100',
        accent: 'from-amber-500 to-orange-700',
        button: 'bg-amber-700 hover:bg-amber-800',
        text: 'text-amber-700',
        icon: 'text-amber-500'
    },
    crimson: {
        sidebar: 'bg-red-950 text-red-100',
        accent: 'from-red-700 to-red-900',
        button: 'bg-red-800 hover:bg-red-900',
        text: 'text-red-800',
        icon: 'text-red-500'
    },
    pink: {
        sidebar: 'bg-fuchsia-900 text-fuchsia-100',
        accent: 'from-fuchsia-500 to-pink-700',
        button: 'bg-fuchsia-700 hover:bg-fuchsia-800',
        text: 'text-fuchsia-700',
        icon: 'text-fuchsia-400'
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
  const maturity = new Date(item.maturityDate);
  const deposit = new Date(item.depositDate);
  const withdrawal = item.withdrawalDate ? new Date(item.withdrawalDate) : null;
  const isCompleted = !!item.withdrawalDate;

  const calcEndDate = withdrawal || (now > maturity ? now : maturity);
  const realDurationDays = Math.max(1, Math.round((calcEndDate.getTime() - deposit.getTime()) / MS_PER_DAY));
  
  const interestDays = getDaysDiff(item.depositDate, item.maturityDate);
  
  let baseInterest = 0;
  let annualizedYield = 0;
  let hasYieldInfo = true;

  if (isCompleted && item.realizedReturn !== undefined) {
      baseInterest = item.realizedReturn;
      annualizedYield = ((baseInterest / item.principal) / (realDurationDays / 365)) * 100;
  } else if (item.expectedRate !== undefined && item.expectedRate !== null) {
      const rate = item.expectedRate;
      annualizedYield = rate;
      const durationForCalc = isCompleted ? realDurationDays : interestDays;
      baseInterest = item.principal * (rate / 100) * (durationForCalc / 365);
  } else {
      hasYieldInfo = false;
      baseInterest = 0;
      annualizedYield = 0;
  }
  
  const totalReturn = baseInterest + item.rebate;

  let comprehensiveYield = 0;
  if (hasYieldInfo || item.rebate > 0) {
      comprehensiveYield = ((totalReturn / item.principal) / (realDurationDays / 365)) * 100;
  }

  const profit = totalReturn; 

  return {
    interestDays,
    baseInterest,
    totalReturn,
    profit,
    realDurationDays,
    annualizedYield,
    comprehensiveYield,
    isCompleted,
    hasYieldInfo,
    daysRemaining: getDaysRemaining(item.maturityDate)
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
  
  let weightedYieldSum = 0;
  let totalWeight = 0;

  items.forEach(item => {
    const metrics = calculateItemMetrics(item);
    
    totalInvested += item.principal;
    totalRebate += item.rebate;
    
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

    if ((metrics.hasYieldInfo || item.rebate > 0) && metrics.comprehensiveYield > -100 && metrics.comprehensiveYield < 1000) { 
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
        } else {
            if (metrics.hasYieldInfo) {
               value += metrics.totalReturn; 
            } else {
               value += item.rebate;
            }
        }

        totalValuation += convertCurrency(value, item.currency, targetCurrency, rates);
    });

    return totalValuation;
};

export const filterInvestmentsByTime = (items: Investment[], filter: TimeFilter): Investment[] => {
    if (filter === 'all') return items;
    
    const now = new Date();
    
    return items.filter(item => {
        const d = new Date(item.depositDate);
        switch (filter) {
            case '1m': return d >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            case '3m': return d >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            case '6m': return d >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            case '1y': return d >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            case 'mtd': return d >= new Date(now.getFullYear(), now.getMonth(), 1);
            case 'ytd': return d >= new Date(now.getFullYear(), 0, 1);
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