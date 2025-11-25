
export type Currency = 'CNY' | 'USD' | 'HKD';

export type InvestmentCategory = 'Fixed' | 'Deposit' | 'Fund' | 'Stock' | 'Cash' | 'Other';
export type InvestmentType = 'Fixed' | 'Floating'; // Fixed Income vs Floating/Non-fixed

export const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
    Fixed: '固收理财',
    Deposit: '定期存款',
    Fund: '基金',
    Stock: '股票',
    Cash: '现金资产',
    Other: '其他'
};

export type ThemeOption = 'slate' | 'midnight' | 'forest' | 'ocean' | 'sunset' | 'royal' | 'amber' | 'teal' | 'crimson' | 'pink' | 'lavender' | 'mint' | 'sky' | 'sakura' | 'ivory';

export interface UserPreferences {
    theme?: ThemeOption;
    rates?: ExchangeRates;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    preferences?: UserPreferences;
}

export type ExchangeRates = Record<Currency, number>;

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
    CNY: 1,
    USD: 7.23,
    HKD: 0.92
};

export interface Investment {
  id: string;
  userId?: string; 
  name: string; 
  category: InvestmentCategory;
  type: InvestmentType; // New: Fixed or Floating
  currency: Currency;
  depositDate: string; // ISO Date YYYY-MM-DD
  maturityDate: string; // ISO Date YYYY-MM-DD (Optional for Floating)
  withdrawalDate: string | null; 
  principal: number;
  quantity?: number; // New: For Stocks/Funds (Shares/Units)
  expectedRate?: number; // Optional for Floating
  currentReturn?: number; // New: Manual entry for current position return (floating)
  realizedReturn?: number; 
  rebate: number; 
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
  realizedInterest: number; 
  comprehensiveYield: number; 
}

export type ViewState = 'dashboard' | 'list' | 'add' | 'calendar' | 'profile' | 'auth';

export type TimeFilter = 'all' | '1m' | '3m' | '6m' | '1y' | 'mtd' | 'ytd' | 'custom';
