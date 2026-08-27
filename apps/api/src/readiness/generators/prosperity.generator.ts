import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';

import { calculateBalance } from '@wardkeep/finance-engine';
import { TransactionType, DEBT_ACCOUNT_TYPES } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';

/** Liability account types used to compute total debt. */
const LIABILITY_TYPES = DEBT_ACCOUNT_TYPES.map((t) => t as string);

/**
 * Generates readiness signals for the Prosperity pillar.
 * Covers: net worth trend, debt-to-income ratio, and debt payoff progress.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of readiness signals for the prosperity pillar
 */
export async function generateProsperitySignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const netWorthSignals = await generateNetWorthTrendSignals(prisma, userId);
  const debtIncomeSignals = await generateDebtToIncomeSignals(prisma, userId);
  const debtProgressSignals = await generateDebtPayoffProgressSignals(prisma, userId);

  signals.push(...netWorthSignals, ...debtIncomeSignals, ...debtProgressSignals);
  return signals;
}

/**
 * Computes the current balance for an account using the same pattern as AccountsService.
 * @param account - Account with transactions and linkedBankAccounts
 * @returns Current balance as a Decimal
 */
function computeAccountBalance(account: {
  initialBalance: { toString(): string };
  transactions: Array<{ amount: { toString(): string }; type: string; aiConfidence: { toString(): string } | null }>;
  linkedBankAccounts: Array<{ id: string }>;
}): Decimal {
  if (account.linkedBankAccounts.length > 0) {
    return new Decimal(account.initialBalance.toString());
  }
  return calculateBalance(
    new Decimal(account.initialBalance.toString()),
    account.transactions.map((tx) => ({
      ...tx,
      amount: tx.amount.toString(),
      type: tx.type as unknown as TransactionType,
      aiConfidence: tx.aiConfidence?.toString() ?? null,
    })),
  );
}

/**
 * Generates signals based on net worth direction over the past 30 days.
 * Compares current net worth against historical snapshot if available.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of net-worth-trend signals
 */
async function generateNetWorthTrendSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const [accounts, vehicles] = await Promise.all([prisma.account.findMany({
    where: { userId, isArchived: false },
    include: {
      transactions: true,
      linkedBankAccounts: { select: { id: true } },
      debtProfile: { select: { assetValue: true } },
    },
  }), prisma.vehicle.findMany({ where: { userId, isActive: true, ownership: { in: ['OWNED', 'FINANCED', 'OTHER'] }, estimatedValue: { not: null } }, select: { estimatedValue: true, loanBalance: true } })]);

  let assets = new Decimal(0);
  let liabilities = new Decimal(0);

  for (const account of accounts) {
    const balance = computeAccountBalance(account);
    if (LIABILITY_TYPES.includes(account.type)) {
      liabilities = liabilities.add(balance.abs());

      // Add linked asset value (home, vehicle) to assets side
      const assetValue = (account as { debtProfile?: { assetValue: { toString(): string } | null } | null }).debtProfile?.assetValue;
      if (assetValue) {
        assets = assets.add(new Decimal(assetValue.toString()));
      }
    } else {
      assets = assets.add(balance);
    }
  }

  // Leased vehicles are not household assets. For recorded owned/financed values,
  // include the estimate and its separately recorded loan balance transparently.
  for (const vehicle of vehicles) {
    assets = assets.add(new Decimal(vehicle.estimatedValue!.toString()));
    if (vehicle.loanBalance) liabilities = liabilities.add(new Decimal(vehicle.loanBalance.toString()));
  }

  const currentNetWorth = assets.sub(liabilities);

  // Check for a historical snapshot from ~30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const previousSnapshot = await prisma.readinessSnapshot.findFirst({
    where: {
      userId,
      recordedAt: { lte: thirtyDaysAgo },
    },
    orderBy: { recordedAt: 'desc' },
  });

  if (!previousSnapshot) {
    // No historical data yet — neutral
    if (currentNetWorth.gt(0)) {
      signals.push({
        capabilityId: 'accounts',
        type: 'positive',
        magnitude: 3,
        pillar: 'prosperity',
        summary: `Positive net worth of $${currentNetWorth.toFixed(2)}.`,
        weight: 1.0,
      });
    } else if (currentNetWorth.lt(0)) {
      signals.push({
        capabilityId: 'accounts',
        type: 'risk',
        magnitude: -4,
        pillar: 'prosperity',
        summary: `Negative net worth of $${currentNetWorth.toFixed(2)}. Debt exceeds assets.`,
        weight: 1.0,
      });
    }
    return signals;
  }

  // We have a snapshot but it only stores readiness scores, not raw net worth.
  // For now, produce a signal based on current net worth state alone.
  // Future: store net worth in snapshots for trend comparison.
  if (currentNetWorth.gt(0)) {
    signals.push({
      capabilityId: 'accounts',
      type: 'positive',
      magnitude: 4,
      pillar: 'prosperity',
      summary: `Net worth is positive at $${currentNetWorth.toFixed(2)}.`,
      weight: 1.0,
    });
  } else {
    signals.push({
      capabilityId: 'accounts',
      type: 'risk',
      magnitude: -5,
      pillar: 'prosperity',
      summary: `Net worth is negative at $${currentNetWorth.toFixed(2)}. Focus on debt reduction.`,
      weight: 1.0,
    });
  }

  return signals;
}

/**
 * Generates signals based on debt-to-income ratio.
 * Compares total monthly debt obligations to monthly income.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of debt-to-income signals
 */
async function generateDebtToIncomeSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  // Get total minimum payments from debt profiles
  const debtProfiles = await prisma.debtProfile.findMany({
    where: { userId },
  });

  const totalMinimumPayments = debtProfiles.reduce(
    (sum, profile) => sum.add(new Decimal(profile.minimumPayment.toString())),
    new Decimal(0),
  );

  if (totalMinimumPayments.isZero()) {
    // No debt obligations — positive signal
    signals.push({
      capabilityId: 'debt',
      type: 'positive',
      magnitude: 6,
      pillar: 'prosperity',
      summary: 'No monthly debt obligations. Debt-free status.',
      weight: 1.5,
    });
    return signals;
  }

  // Estimate monthly income from CREDIT transactions in the last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const incomeTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.CREDIT,
      date: { gte: sixtyDaysAgo },
    },
  });

  const totalIncomeOver60Days = incomeTransactions.reduce(
    (sum, tx) => sum.add(new Decimal(tx.amount.toString())),
    new Decimal(0),
  );

  const monthlyIncome = totalIncomeOver60Days.div(2); // 60 days ≈ 2 months

  if (monthlyIncome.isZero()) {
    // No income detected — can't compute DTI, but debt exists
    signals.push({
      capabilityId: 'debt',
      type: 'warning',
      magnitude: -4,
      pillar: 'prosperity',
      summary: 'Debt obligations exist but no income detected in the last 60 days.',
      weight: 1.0,
    });
    return signals;
  }

  const dtiRatio = totalMinimumPayments.div(monthlyIncome);

  if (dtiRatio.gt(new Decimal('0.50'))) {
    // Critical: >50% of income goes to debt
    signals.push({
      capabilityId: 'debt',
      type: 'risk',
      magnitude: -8,
      pillar: 'prosperity',
      summary: `Debt-to-income ratio is ${dtiRatio.mul(100).toFixed(0)}%. Over half of income goes to debt payments.`,
      weight: 2.0,
    });
  } else if (dtiRatio.gt(new Decimal('0.36'))) {
    // Warning: 36-50% DTI (above recommended threshold)
    signals.push({
      capabilityId: 'debt',
      type: 'warning',
      magnitude: -4,
      pillar: 'prosperity',
      summary: `Debt-to-income ratio is ${dtiRatio.mul(100).toFixed(0)}%. Above the recommended 36% threshold.`,
      weight: 1.5,
    });
  } else if (dtiRatio.gt(new Decimal('0.20'))) {
    // Moderate DTI — acceptable but room to improve
    signals.push({
      capabilityId: 'debt',
      type: 'positive',
      magnitude: 2,
      pillar: 'prosperity',
      summary: `Debt-to-income ratio is ${dtiRatio.mul(100).toFixed(0)}%. Within healthy range.`,
      weight: 1.0,
    });
  } else {
    // Low DTI — excellent
    signals.push({
      capabilityId: 'debt',
      type: 'positive',
      magnitude: 5,
      pillar: 'prosperity',
      summary: `Debt-to-income ratio is ${dtiRatio.mul(100).toFixed(0)}%. Excellent debt management.`,
      weight: 1.0,
    });
  }

  return signals;
}

/**
 * Generates signals based on debt payoff progress.
 * Checks if user has a saved payoff plan and whether debts are decreasing.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of debt-payoff-progress signals
 */
async function generateDebtPayoffProgressSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const debtProfiles = await prisma.debtProfile.findMany({
    where: { userId },
    include: {
      account: {
        include: {
          transactions: true,
          linkedBankAccounts: { select: { id: true } },
        },
      },
    },
  });

  if (debtProfiles.length === 0) {
    return signals;
  }

  // Compute total outstanding debt
  let totalDebt = new Decimal(0);
  let highInterestCount = 0;

  for (const profile of debtProfiles) {
    if (profile.account.isArchived) continue;

    const balance = computeAccountBalance(profile.account).abs();
    totalDebt = totalDebt.add(balance);

    // Flag high-interest debts (APR > 20%)
    const apr = new Decimal(profile.apr.toString());
    if (apr.gt(new Decimal('0.20'))) {
      highInterestCount++;
    }
  }

  if (totalDebt.isZero()) {
    signals.push({
      capabilityId: 'debt',
      type: 'milestone',
      magnitude: 8,
      pillar: 'prosperity',
      summary: 'All debts are paid off. Outstanding achievement.',
      weight: 2.0,
    });
    return signals;
  }

  if (highInterestCount > 0) {
    signals.push({
      capabilityId: 'debt',
      type: 'warning',
      magnitude: -5,
      pillar: 'prosperity',
      summary: `${highInterestCount} ${highInterestCount === 1 ? 'debt has' : 'debts have'} APR above 20%. Prioritize these for faster payoff.`,
      weight: 1.5,
    });
  }

  // Check for a saved payoff plan — having a plan is a positive signal
  const savedPlan = await prisma.savedPayoffPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (savedPlan) {
    signals.push({
      capabilityId: 'debt',
      type: 'positive',
      magnitude: 3,
      pillar: 'prosperity',
      summary: `Active payoff plan ("${savedPlan.name}") targets debt freedom in ${savedPlan.totalMonths} months.`,
      weight: 1.0,
    });
  } else if (totalDebt.gt(new Decimal('1000'))) {
    signals.push({
      capabilityId: 'debt',
      type: 'opportunity',
      magnitude: 2,
      pillar: 'prosperity',
      summary: `$${totalDebt.toFixed(2)} in outstanding debt without a payoff plan. Creating one accelerates freedom.`,
      weight: 1.0,
    });
  }

  return signals;
}
