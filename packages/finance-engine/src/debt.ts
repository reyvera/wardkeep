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


// ─── Consolidation Calculator ───────────────────────────────────────────────────

export interface ConsolidationParams {
  /** APR for the consolidated loan (as decimal 0–1). */
  newApr: string;
  /** Term in months for the consolidated loan. */
  termMonths: number;
  /** One-time origination fee as a percentage of total balance (0–1). Optional. */
  originationFee?: string;
}

export interface ConsolidationResult {
  /** The payoff schedule for the single consolidated loan. */
  schedule: DebtSchedule;
  /** Monthly payment for the new consolidated loan. */
  monthlyPayment: Decimal;
  /** Total interest paid on the consolidated loan. */
  totalInterest: Decimal;
  /** Total cost including origination fee. */
  totalCost: Decimal;
  /** Interest savings vs. the baseline (minimum payments only). */
  interestSavingsVsBaseline: Decimal;
  /** Time savings in months vs. the baseline. */
  timeSavingsVsBaseline: number;
  /** Warning if the consolidation results in higher costs. */
  warning?: string;
}

/**
 * Calculates a debt consolidation scenario: combine all debts into a single
 * fixed-rate loan and compare against the current minimum-payment baseline.
 *
 * @param debts - Array of current debts.
 * @param params - Consolidation parameters (new APR, term, optional origination fee).
 * @returns Consolidation result with schedule and comparison against baseline.
 */
export function calculateConsolidation(
  debts: Debt[],
  params: ConsolidationParams,
): ConsolidationResult {
  const totalBalance = debts.reduce(
    (sum, d) => sum.plus(new Decimal(d.balance)),
    new Decimal(0),
  );

  const originationRate = params.originationFee ? new Decimal(params.originationFee) : new Decimal(0);
  const originationAmount = totalBalance.times(originationRate);
  const loanBalance = totalBalance.plus(originationAmount);

  const newApr = new Decimal(params.newApr);
  const monthlyRate = newApr.div(12);
  const termMonths = params.termMonths;

  // Calculate fixed monthly payment using amortization formula:
  // M = P * [r(1+r)^n] / [(1+r)^n - 1]
  let monthlyPayment: Decimal;
  if (monthlyRate.eq(0)) {
    // Zero interest: simple division
    monthlyPayment = loanBalance.div(termMonths);
  } else {
    const onePlusR = new Decimal(1).plus(monthlyRate);
    const onePlusRToN = onePlusR.pow(termMonths);
    const numerator = monthlyRate.times(onePlusRToN);
    const denominator = onePlusRToN.minus(1);
    monthlyPayment = loanBalance.times(numerator.div(denominator));
  }

  // Build amortization schedule for the consolidated loan
  let balance = loanBalance;
  const months: MonthlyPayment[] = [];
  let totalInterest = new Decimal(0);
  let totalPaid = new Decimal(0);
  let payoffMonth = termMonths;

  for (let m = 1; m <= termMonths && balance.gt(0); m++) {
    const interest = balance.times(monthlyRate);
    const payment = Decimal.min(monthlyPayment, balance.plus(interest));
    const principal = payment.minus(interest);
    balance = balance.minus(principal);

    // Avoid negative balance from rounding
    if (balance.lt(new Decimal('0.005'))) {
      balance = new Decimal(0);
    }

    totalInterest = totalInterest.plus(interest);
    totalPaid = totalPaid.plus(payment);

    months.push({
      month: m,
      debtId: 'consolidated',
      payment,
      principal,
      interest,
      remainingBalance: Decimal.max(balance, new Decimal(0)),
    });

    if (balance.lte(0) && payoffMonth === termMonths) {
      payoffMonth = m;
    }
  }

  const schedule: DebtSchedule = {
    debtId: 'consolidated',
    debtName: 'Consolidated Loan',
    months,
    totalInterest,
    totalPaid,
    payoffMonth,
  };

  // Compute baseline (minimum payments only) for comparison
  const baseline = calculateMinimumOnlyPayoff(debts);
  const interestSavingsVsBaseline = baseline.totalInterest.minus(totalInterest.plus(originationAmount));
  const timeSavingsVsBaseline = baseline.totalMonths - payoffMonth;

  const totalCost = totalInterest.plus(originationAmount);

  const result: ConsolidationResult = {
    schedule,
    monthlyPayment,
    totalInterest,
    totalCost,
    interestSavingsVsBaseline,
    timeSavingsVsBaseline,
  };

  if (interestSavingsVsBaseline.lt(0)) {
    result.warning = 'Consolidation would cost more in interest than your current minimum payments. Consider a lower rate or shorter term.';
  }

  return result;
}

// ─── Minimum-Only Baseline ──────────────────────────────────────────────────────

/**
 * Calculates how long it takes to pay off all debts using only the minimum payments.
 * This serves as the baseline to compare against other strategies.
 *
 * @param debts - Array of debts with current balances and minimum payments.
 * @returns PayoffResult with the minimum-only schedule.
 */
export function calculateMinimumOnlyPayoff(debts: Debt[]): PayoffResult {
  const sumOfMinimums = debts.reduce(
    (sum, d) => sum.plus(new Decimal(d.minimumPayment)),
    new Decimal(0),
  );

  return calculatePayoffSchedule(debts, 'avalanche', sumOfMinimums);
}

// ─── Velocity Banking (HELOC Chunking) ──────────────────────────────────────────

export interface VelocityBankingParams {
  /** HELOC or line-of-credit available limit. */
  helocLimit: string;
  /** HELOC APR (as decimal 0–1). */
  helocApr: string;
  /** Monthly disposable income available to pay down the HELOC (income minus expenses). */
  monthlyDisposableIncome: string;
  /** How much to chunk from the HELOC into the target debt each cycle. */
  chunkAmount: string;
}

export interface VelocityBankingResult {
  /** The payoff schedule with HELOC chunking applied. */
  schedules: DebtSchedule[];
  /** Total interest paid on all debts combined. */
  totalInterest: Decimal;
  /** Total interest paid on the HELOC itself. */
  helocInterest: Decimal;
  /** Combined interest (debts + HELOC usage). */
  combinedInterest: Decimal;
  /** Total months to be debt-free (including HELOC payback). */
  totalMonths: number;
  /** Interest savings vs. minimum-only baseline. */
  interestSavingsVsBaseline: Decimal;
  /** Time savings in months vs. minimum-only baseline. */
  timeSavingsVsBaseline: number;
  /** Warning if velocity banking is not beneficial. */
  warning?: string;
}

/**
 * Calculates a velocity banking strategy:
 * Use a HELOC (or line of credit) to make lump-sum payments against the
 * highest-interest debt, then use monthly disposable income to pay down the
 * HELOC before repeating.
 *
 * The cycle:
 * 1. Draw chunkAmount from HELOC, apply to highest-APR debt.
 * 2. Each month, put disposable income toward paying off the HELOC balance.
 * 3. While paying HELOC, continue minimum payments on all other debts.
 * 4. Once HELOC is cleared, draw another chunk. Repeat until all debts are gone.
 *
 * @param debts - Array of debts (excluding the HELOC itself).
 * @param params - Velocity banking parameters.
 * @returns Velocity banking result with schedules and comparison.
 */
export function calculateVelocityBanking(
  debts: Debt[],
  params: VelocityBankingParams,
): VelocityBankingResult {
  const helocLimit = new Decimal(params.helocLimit);
  const helocApr = new Decimal(params.helocApr);
  const helocMonthlyRate = helocApr.div(12);
  const monthlyDisposable = new Decimal(params.monthlyDisposableIncome);
  const chunkAmount = Decimal.min(new Decimal(params.chunkAmount), helocLimit);

  // Validate
  if (monthlyDisposable.lte(0)) {
    return {
      schedules: [],
      totalInterest: new Decimal(0),
      helocInterest: new Decimal(0),
      combinedInterest: new Decimal(0),
      totalMonths: 0,
      interestSavingsVsBaseline: new Decimal(0),
      timeSavingsVsBaseline: 0,
      warning: 'Monthly disposable income must be greater than zero for velocity banking.',
    };
  }

  // Sort debts by highest APR (velocity banking targets highest rate first)
  const sortedDebts = [...debts].sort(
    (a, b) => new Decimal(b.apr).cmp(new Decimal(a.apr)),
  );

  // Working state
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

  let helocBalance = new Decimal(0);
  let helocTotalInterest = new Decimal(0);
  let month = 0;

  while (month < MAX_PROJECTION_MONTHS) {
    // Check if all debts + HELOC are paid off
    const allDebtsPaid = sortedDebts.every((d) => balances.get(d.id)!.lte(0));
    if (allDebtsPaid && helocBalance.lte(0)) {
      break;
    }

    month++;

    // Chunk: If HELOC is empty (or nearly empty), draw a new chunk to apply to highest-APR debt
    if (helocBalance.lte(new Decimal('0.01'))) {
      // Find first unpaid debt
      const targetDebt = sortedDebts.find((d) => balances.get(d.id)!.gt(0));
      if (targetDebt) {
        const targetBalance = balances.get(targetDebt.id)!;
        const chunk = Decimal.min(chunkAmount, targetBalance, helocLimit);
        if (chunk.gt(0)) {
          // Apply chunk to the target debt's balance
          balances.set(targetDebt.id, targetBalance.minus(chunk));
          helocBalance = helocBalance.plus(chunk);
        }
      }
    }

    // Process monthly interest and minimum payments on all debts
    for (const debt of sortedDebts) {
      const balance = balances.get(debt.id)!;
      if (balance.lte(0)) {
        if (payoffMonthPerDebt.get(debt.id) === 0) {
          payoffMonthPerDebt.set(debt.id, month);
        }
        continue;
      }

      const monthlyRate = new Decimal(debt.apr).div(12);
      const interest = balance.times(monthlyRate);
      const balancePlusInterest = balance.plus(interest);
      const minPayment = Decimal.min(new Decimal(debt.minimumPayment), balancePlusInterest);
      const principal = minPayment.minus(interest);
      const newBalance = Decimal.max(balance.minus(principal), new Decimal(0));

      balances.set(debt.id, newBalance);
      totalInterestPerDebt.set(debt.id, totalInterestPerDebt.get(debt.id)!.plus(interest));
      totalPaidPerDebt.set(debt.id, totalPaidPerDebt.get(debt.id)!.plus(minPayment));

      scheduleMonths.get(debt.id)!.push({
        month,
        debtId: debt.id,
        payment: minPayment,
        principal,
        interest,
        remainingBalance: newBalance,
      });

      if (newBalance.lte(0) && payoffMonthPerDebt.get(debt.id) === 0) {
        payoffMonthPerDebt.set(debt.id, month);
      }
    }

    // HELOC: accrue interest and apply disposable income
    if (helocBalance.gt(0)) {
      const helocInterest = helocBalance.times(helocMonthlyRate);
      helocBalance = helocBalance.plus(helocInterest);
      helocTotalInterest = helocTotalInterest.plus(helocInterest);

      // Apply all disposable income to HELOC
      const helocPayment = Decimal.min(monthlyDisposable, helocBalance);
      helocBalance = helocBalance.minus(helocPayment);

      if (helocBalance.lt(new Decimal('0.01'))) {
        helocBalance = new Decimal(0);
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

  const totalDebtInterest = schedules.reduce(
    (sum, s) => sum.plus(s.totalInterest),
    new Decimal(0),
  );

  const combinedInterest = totalDebtInterest.plus(helocTotalInterest);

  // Baseline comparison
  const baseline = calculateMinimumOnlyPayoff(debts);
  const interestSavingsVsBaseline = baseline.totalInterest.minus(combinedInterest);
  const timeSavingsVsBaseline = baseline.totalMonths - month;

  const result: VelocityBankingResult = {
    schedules,
    totalInterest: totalDebtInterest,
    helocInterest: helocTotalInterest,
    combinedInterest,
    totalMonths: month,
    interestSavingsVsBaseline,
    timeSavingsVsBaseline,
  };

  if (interestSavingsVsBaseline.lt(0)) {
    result.warning = 'Velocity banking would cost more than minimum payments in this scenario. The HELOC rate may be too high relative to your debt rates.';
  }

  if (month >= MAX_PROJECTION_MONTHS) {
    result.warning = `Projection capped at ${MAX_PROJECTION_MONTHS} months. Debts may not be fully paid off.`;
  }

  return result;
}
