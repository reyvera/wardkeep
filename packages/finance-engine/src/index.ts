export const PACKAGE_NAME = '@wardkeep/finance-engine';

export { calculateBalance } from './balance';
export { calculateBudgetProgress, calculateBudgetSummary } from './budget';
export type { CategoryProgress, BudgetSummary, BudgetStatus } from './budget';
export { calculateNetWorth } from './net-worth';
export type { NetWorthSummary, AccountWithTransactions } from './net-worth';
export { verifyAIClaim } from './verification';
export type {
  ClaimType,
  NumericalClaim,
  FinancialContext,
  VerificationResult,
} from './verification';
export { calculatePayoffSchedule, compareStrategies, calculateConsolidation, calculateMinimumOnlyPayoff, calculateVelocityBanking } from './debt';
export type {
  PayoffStrategy,
  Debt,
  MonthlyPayment,
  DebtSchedule,
  PayoffResult,
  StrategyComparison,
  ConsolidationParams,
  ConsolidationResult,
  VelocityBankingParams,
  VelocityBankingResult,
} from './debt';
export { projectCashFlow, expandRecurring } from './cash-flow';
export type {
  CashFlowAccount,
  OneTimeEvent,
  DailyProjection,
  BelowZeroNotification,
  CashFlowResult,
} from './cash-flow';
