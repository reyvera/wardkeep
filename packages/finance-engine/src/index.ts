export const PACKAGE_NAME = '@budgetapp/finance-engine';

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
export { calculatePayoffSchedule, compareStrategies } from './debt';
export type {
  PayoffStrategy,
  Debt,
  MonthlyPayment,
  DebtSchedule,
  PayoffResult,
  StrategyComparison,
} from './debt';
export { projectCashFlow, expandRecurring } from './cash-flow';
export type {
  CashFlowAccount,
  OneTimeEvent,
  DailyProjection,
  BelowZeroNotification,
  CashFlowResult,
} from './cash-flow';
