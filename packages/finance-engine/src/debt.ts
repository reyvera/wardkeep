/**
 * Debt payoff calculator with snowball, avalanche, and custom priority strategies.
 *
 * Pure functions that compute amortization schedules without modifying actual data (what-if mode).
 * Uses Decimal.js with 20-digit precision for intermediate calculations.
 */
import { Decimal } from 'decimal.js';

import { MAX_DEBTS, MAX_PROJECTION_MONTHS } from '@wardkeep/shared';

// Set precision to 20 for intermediate interest calculations (10+ decimal places)
Decimal.set({ precision: 20 });

// ─── Types ──────────────────────────────────────────────────────────────────────

export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export interface Debt {
  id: string;
  name: string;
  balance: string;
  apr: string;
  minimumPayment: string;
  priority?: number;
}

export interface MonthlyPayment {
  month: number;
  debtId: string;
  payment: Decimal;
  principal: Decimal;
  interest: Decimal;
  remainingBalance: Decimal;
}

export interface DebtSchedule {
  debtId: string;
  debtName: string;
  months: MonthlyPayment[];
  totalInterest: Decimal;
  totalPaid: Decimal;
  payoffMonth: number;
}

export interface PayoffResult {
  schedules: DebtSchedule[];
  totalInterest: Decimal;
  totalMonths: number;
  debtFreeDate: number;
  warning?: string;
}

export interface StrategyComparison {
  strategies: { strategy: PayoffStrategy; result: PayoffResult }[];
  interestSavings: Decimal;
  timeSavings: number;
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validates a single debt input.
 *
 * @param debt - The debt to validate.
 * @returns An error message if invalid, or null if valid.
 */
function validateDebt(debt: Debt): string | null {
  const balance = new Decimal(debt.balance);
  const apr = new Decimal(debt.apr);
  const minPayment = new Decimal(debt.minimumPayment);

  if (balance.lte(0)) {
    return `Debt "${debt.name}": balance must be greater than 0`;
  }
  if (apr.lt(0) || apr.gt(1)) {
    return `Debt "${debt.name}": APR must be between 0 and 1 (0%–100%)`;
  }
  if (minPayment.lt(new Decimal('0.01'))) {
    return `Debt "${debt.name}": minimum payment must be at least 0.01`;
  }
  return null;
}

// ─── Sorting ────────────────────────────────────────────────────────────────────

/**
 * Sorts debts according to the specified payoff strategy.
 *
 * @param debts - Array of debts to sort.
 * @param strategy - The payoff strategy determining sort order.
 * @returns A new sorted array of debts (does not mutate input).
 */
function sortDebtsByStrategy(debts: Debt[], strategy: PayoffStrategy): Debt[] {
  const sorted = [...debts];
  switch (strategy) {
    case 'snowball':
      // Lowest balance first
      sorted.sort((a, b) => new Decimal(a.balance).cmp(new Decimal(b.balance)));
      break;
    case 'avalanche':
      // Highest APR first
      sorted.sort((a, b) => new Decimal(b.apr).cmp(new Decimal(a.apr)));
      break;
    case 'custom':
      // Ascending priority (lower number = higher priority)
      sorted.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
      break;
  }
  return sorted;
}

// ─── Core Calculator ────────────────────────────────────────────────────────────

/**
 * Calculates the complete payoff schedule for a set of debts using the specified strategy.
 *
 * This is a pure function (what-if mode) — it does not modify actual data.
 *
 * @param debts - Array of debts to calculate payoff for (max 50).
 * @param strategy - The payoff strategy: 'snowball', 'avalanche', or 'custom'.
 * @param totalMonthlyPayment - Total monthly payment available for all debts combined.
 * @returns The payoff result including schedules, total interest, and debt-free date.
 */
export function calculatePayoffSchedule(
  debts: Debt[],
  strategy: PayoffStrategy,
  totalMonthlyPayment: Decimal,
): PayoffResult {
  // Validate debt count
  if (debts.length > MAX_DEBTS) {
    return {
      schedules: [],
      totalInterest: new Decimal(0),
      totalMonths: 0,
      debtFreeDate: 0,
      warning: `Cannot process more than ${MAX_DEBTS} debts`,
    };
  }

  // Validate each debt
  for (const debt of debts) {
    const error = validateDebt(debt);
    if (error) {
      return {
        schedules: [],
        totalInterest: new Decimal(0),
        totalMonths: 0,
        debtFreeDate: 0,
        warning: error,
      };
    }
  }

  // Check if sum of minimums exceeds total payment
  const sumOfMinimums = debts.reduce(
    (sum, d) => sum.plus(new Decimal(d.minimumPayment)),
    new Decimal(0),
  );

  if (sumOfMinimums.gt(totalMonthlyPayment)) {
    return {
      schedules: [],
      totalInterest: new Decimal(0),
      totalMonths: 0,
      debtFreeDate: 0,
      warning: 'Total monthly payment is less than the sum of minimum payments. No schedule generated.',
    };
  }

  // Sort debts by strategy
  const sortedDebts = sortDebtsByStrategy(debts, strategy);

  // Initialize working balances and schedule accumulators
  const balances: Map<string, Decimal> = new Map();
  const scheduleMonths: Map<string, MonthlyPayment[]> = new Map();
  const totalInterestPerDebt: Map<string, Decimal> = new Map();
  const totalPaidPerDebt: Map<string, Decimal> = new Map();
  const payoffMonthPerDebt: Map<string, number> = new Map();

  for (const debt of sortedDebts) {
    balances.set(debt.id, new Decimal(debt.balance));
    scheduleMonths.set(debt.id, []);
    totalInterestPerDebt.set(debt.id, new Decimal(0));
    totalPaidPerDebt.set(debt.id, new Decimal(0));
    payoffMonthPerDebt.set(debt.id, 0);
  }

  let month = 0;
  let allPaidOff = false;

  while (!allPaidOff && month < MAX_PROJECTION_MONTHS) {
    month++;
    allPaidOff = true;

    let remainingPayment = totalMonthlyPayment;

    // Phase 1: Calculate interest and pay minimums on all debts
    const interestThisMonth: Map<string, Decimal> = new Map();
    const minimumPayments: Map<string, Decimal> = new Map();

    for (const debt of sortedDebts) {
      const balance = balances.get(debt.id)!;
      if (balance.lte(0)) {
        continue;
      }

      allPaidOff = false;

      // Calculate monthly interest: balance × (APR / 12)
      const monthlyRate = new Decimal(debt.apr).div(12);
      const interest = balance.times(monthlyRate);
      interestThisMonth.set(debt.id, interest);

      // Determine minimum payment (capped at balance + interest)
      const balancePlusInterest = balance.plus(interest);
      const minPayment = Decimal.min(new Decimal(debt.minimumPayment), balancePlusInterest);
      minimumPayments.set(debt.id, minPayment);

      remainingPayment = remainingPayment.minus(minPayment);
    }

    if (allPaidOff) {
      break;
    }

    // Phase 2: Apply minimum payments
    for (const debt of sortedDebts) {
      const balance = balances.get(debt.id)!;
      if (balance.lte(0)) {
        continue;
      }

      const interest = interestThisMonth.get(debt.id)!;
      const minPayment = minimumPayments.get(debt.id)!;
      const principal = minPayment.minus(interest);
      const newBalance = balance.minus(principal);

      balances.set(debt.id, newBalance);
    }

    // Phase 3: Distribute extra payment to priority debt(s)
    for (const debt of sortedDebts) {
      if (remainingPayment.lte(0)) {
        break;
      }

      const balance = balances.get(debt.id)!;
      if (balance.lte(0)) {
        continue;
      }

      // Apply as much extra as possible to this debt
      const extraPayment = Decimal.min(remainingPayment, balance);
      const newBalance = balance.minus(extraPayment);
      balances.set(debt.id, newBalance);
      remainingPayment = remainingPayment.minus(extraPayment);

      // Update the minimum payment record to include extra
      const currentMin = minimumPayments.get(debt.id)!;
      minimumPayments.set(debt.id, currentMin.plus(extraPayment));
    }

    // Phase 4: Record monthly entries
    for (const debt of sortedDebts) {
      const interest = interestThisMonth.get(debt.id);
      if (interest === undefined) {
        continue; // Debt was already paid off before this month
      }

      const totalPayment = minimumPayments.get(debt.id)!;
      const principal = totalPayment.minus(interest);
      const currentBalance = balances.get(debt.id)!;
      // Ensure we never show negative balance due to rounding
      const displayBalance = Decimal.max(currentBalance, new Decimal(0));

      const monthlyPayment: MonthlyPayment = {
        month,
        debtId: debt.id,
        payment: totalPayment,
        principal,
        interest,
        remainingBalance: displayBalance,
      };

      scheduleMonths.get(debt.id)!.push(monthlyPayment);
      totalInterestPerDebt.set(debt.id, totalInterestPerDebt.get(debt.id)!.plus(interest));
      totalPaidPerDebt.set(debt.id, totalPaidPerDebt.get(debt.id)!.plus(totalPayment));

      if (displayBalance.lte(0) && payoffMonthPerDebt.get(debt.id) === 0) {
        payoffMonthPerDebt.set(debt.id, month);
      }
    }
  }

  // Build result
  const schedules: DebtSchedule[] = sortedDebts.map((debt) => ({
    debtId: debt.id,
    debtName: debt.name,
    months: scheduleMonths.get(debt.id)!,
    totalInterest: totalInterestPerDebt.get(debt.id)!,
    totalPaid: totalPaidPerDebt.get(debt.id)!,
    payoffMonth: payoffMonthPerDebt.get(debt.id) || month,
  }));

  const totalInterest = schedules.reduce(
    (sum, s) => sum.plus(s.totalInterest),
    new Decimal(0),
  );

  const totalMonths = Math.max(...schedules.map((s) => s.payoffMonth));
  const debtFreeDate = totalMonths;

  const result: PayoffResult = {
    schedules,
    totalInterest,
    totalMonths,
    debtFreeDate,
  };

  // Add warning if capped
  if (month >= MAX_PROJECTION_MONTHS && !allPaidOff) {
    result.warning = `Projection capped at ${MAX_PROJECTION_MONTHS} months. Some debts may not be fully paid off.`;
  }

  return result;
}

// ─── Strategy Comparison ────────────────────────────────────────────────────────

/**
 * Compares multiple payoff strategies, computing interest savings and time differences.
 *
 * @param debts - Array of debts to analyze.
 * @param strategies - Array of strategies to compare.
 * @param totalMonthlyPayment - Total monthly payment available.
 * @returns Comparison results including savings between best and worst strategies.
 */
export function compareStrategies(
  debts: Debt[],
  strategies: PayoffStrategy[],
  totalMonthlyPayment: Decimal,
): StrategyComparison {
  const results = strategies.map((strategy) => ({
    strategy,
    result: calculatePayoffSchedule(debts, strategy, totalMonthlyPayment),
  }));

  // Find best and worst by total interest
  const validResults = results.filter((r) => r.result.schedules.length > 0);

  if (validResults.length === 0) {
    return {
      strategies: results,
      interestSavings: new Decimal(0),
      timeSavings: 0,
    };
  }

  const bestInterest = validResults.reduce((best, curr) =>
    curr.result.totalInterest.lt(best.result.totalInterest) ? curr : best,
  );

  const worstInterest = validResults.reduce((worst, curr) =>
    curr.result.totalInterest.gt(worst.result.totalInterest) ? curr : worst,
  );

  const interestSavings = worstInterest.result.totalInterest.minus(bestInterest.result.totalInterest);

  const bestTime = validResults.reduce((best, curr) =>
    curr.result.totalMonths < best.result.totalMonths ? curr : best,
  );

  const worstTime = validResults.reduce((worst, curr) =>
    curr.result.totalMonths > worst.result.totalMonths ? curr : worst,
  );

  const timeSavings = worstTime.result.totalMonths - bestTime.result.totalMonths;

  return {
    strategies: results,
    interestSavings,
    timeSavings,
  };
}
