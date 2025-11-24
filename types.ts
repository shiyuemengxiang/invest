

export type Currency = 'CNY' | 'USD' | 'HKD';

export type InvestmentCategory = 'Fixed' | 'Deposit' | 'Fund' | 'Stock' | 'Other';

export const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
    Fixed: '固收理财',
    Deposit: '定期存款',
    Fund: '基金',
    Stock: '股票',
    Other: '其他'
};

export type ThemeOption = 'slate' | 'midnight' | 'forest' | 'ocean' | 'sunset' | 'royal' | 'amber' | 'teal' | 'crimson' | 'pink' | 'lavender' | 'mint' | 'sky' | 'sakura' | 'ivory';

export interface User {
    id: string;
    email: string;
    name?: string;
}

export type ExchangeRates = Record<Currency, number>;

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
    CNY: 1,
    USD: 7.23,
    HKD: 0.92
};

export interface Investment {
  id: string;
  userId?: string; // Optional, for DB syncing
  name: string; 
  category: InvestmentCategory;
  currency: Currency;
  depositDate: string; // ISO Date YYYY-MM-DD
  maturityDate: string; // ISO Date YYYY-MM-DD (Target date for stocks)
  withdrawalDate: string | null; // ISO Date YYYY-MM-DD or null if active
  principal: number;
  expectedRate?: number; // Optional Annual Percentage Rate
  realizedReturn?: number; // Actual earnings (amount) when completed
  rebate: number; // Cash rebate/red envelope
  isRebateReceived: boolean;
  notes?: string;
}

export interface InvestmentStats {
  totalInvested: number;
  activePrincipal: number;
  completedPrincipal: number;
  totalRebate: number;
  pendingRebate: number;
  receivedRebate: number;
  realizedInterest: number; // Only from completed
  comprehensiveYield: number; // Portfolio wide weighted average
}

export type ViewState = 'dashboard' | 'list' | 'add' | 'calendar' | 'profile' | 'auth';

export type TimeFilter = 'all' | '1m' | '3m' | '6m' | '1y' | 'mtd' | 'ytd';