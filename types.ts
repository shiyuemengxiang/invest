
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
    rateMode?: 'auto' | 'manual';
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

export interface MarketData {
    price: number;
    change?: number; // Percent change (e.g., 1.5 for 1.5%)
    time?: string;
}

// --- NEW TRANSACTION MODEL ---
export type TransactionType = 'Buy' | 'Sell' | 'Dividend' | 'Interest' | 'Fee' | 'Tax';

export interface Transaction {
    id: string;
    date: string;          // YYYY-MM-DD
    type: TransactionType;
    amount: number;        // Cash flow amount (Positive for deposit/dividend, often negative for buy if tracking cash account, but here represents value involved)
    price?: number;        // Unit price (Funds/Stocks)
    quantity?: number;     // Units (Funds/Stocks)
    fee?: number;          // Handling fee
    notes?: string;
}

export interface Investment {
  id: string;
  userId?: string; 
  name: string; 
  category: InvestmentCategory;
  type: InvestmentType;
  currency: Currency;
  
  // Metadata that might change rarely
  symbol?: string; 
  isAutoQuote?: boolean; 
  notes?: string;
  
  // --- COMPUTED STATE (Derived from Transactions) ---
  // These replace the static inputs for calculation
  currentPrincipal: number;   // Current active principal (Total Buys - Total Sells cost)
  currentQuantity?: number;   // Current holding units
  totalCost: number;          // Total invested amount historically (sum of all Buys)
  totalRealizedProfit: number; // Realized gains (Dividends + Sell Profit)
  
  // --- Transactions History ---
  transactions: Transaction[];

  // --- Legacy/Static Fields (Kept for compatibility or current single-entry logic) ---
  depositDate: string; // Used as "First Buy Date"
  maturityDate: string; 
  withdrawalDate: string | null; // Used as "Fully Exited Date"
  
  // Market / External Data
  estGrowth?: number; 
  lastUpdate?: string; 
  
  // Settings
  expectedRate?: number; // For Fixed: expected annual yield
  interestBasis?: '360' | '365'; // Days per year basis for interest calculation
  
  // For Floating Types (Manual Overrides)
  currentReturn?: number; // Floating P&L (Unrealized)
  
  // Legacy fields kept for UI compatibility during migration, 
  // but logic should prefer computed fields where possible.
  principal: number; // @deprecated: Use currentPrincipal
  quantity?: number; // @deprecated: Use currentQuantity
  realizedReturn?: number; // @deprecated: Use totalRealizedProfit
  rebate: number; 
  isRebateReceived: boolean;
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
  projectedTotalProfit: number; 
  projectedTotalYield: number; 
}

export type ViewState = 'dashboard' | 'list' | 'add' | 'calendar' | 'profile' | 'auth';

export type TimeFilter = 'all' | '1m' | '3m' | '6m' | '1y' | 'mtd' | 'ytd' | 'custom';
