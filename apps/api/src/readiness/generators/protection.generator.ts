import { Decimal } from 'decimal.js';
import { AccountType, PrismaClient } from '@prisma/client';

import { calculateBalance } from '@wardkeep/finance-engine';
import { Transaction, TransactionStatus, TransactionType } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';
import { calculateHouseholdBurnRate } from './burn-rate';

/** A full year is deliberately required for a maximum liquidity score. */
const MAXIMUM_MONTHS = 12;
const MINIMUM_MONTHS = 3;

/**
 * Generates readiness signals for the Protection pillar.
 * Covers: liquid-reserve coverage relative to a conservative household burn rate.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of readiness signals for the protection pillar
 */
export async function generateProtectionSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const emergencyFundSignals = await generateEmergencyFundSignals(prisma, userId);
  const insuranceSignals = await generateInsuranceSignals(prisma, userId);
  signals.push(...emergencyFundSignals, ...insuranceSignals);

  return signals;
}

/**
 * Records insurance renewal risk without claiming that entered policies are adequate.
 * The presence of records is an observed factor; policy limits and household needs are
 * deliberately not converted into an adequacy score until Wardkeep can evaluate them.
 */
async function generateInsuranceSignals(prisma: PrismaClient, userId: string): Promise<Signal[]> {
  const policies = await prisma.insurancePolicy.findMany({
    where: { userId, isActive: true },
    select: { type: true, provider: true, renewalDate: true, deductible: true },
  });
  if (policies.length === 0) return [];

  const signals: Signal[] = [];
  for (const policy of policies) {
    const renewalSignal = insuranceRenewalSignal(policy, new Date());
    if (renewalSignal) signals.push(renewalSignal);
  }
  if (signals.length === 0) {
    signals.push({
      capabilityId: 'insurance',
      type: 'positive',
      magnitude: 1,
      pillar: 'protection',
      summary: `${policies.length} active insurance ${policies.length === 1 ? 'policy is' : 'policies are'} recorded. Wardkeep does not yet assess coverage adequacy.`,
      weight: 0.5,
    });
  }
  const recordedDeductibles = policies
    .map((policy) => (policy.deductible ? new Decimal(policy.deductible.toString()) : null))
    .filter((deductible): deductible is Decimal => deductible !== null);
  if (recordedDeductibles.length > 0) {
    const totalDeductibles = recordedDeductibles.reduce(
      (sum, deductible) => sum.add(deductible),
      new Decimal(0),
    );
    const liquidReserves = await calculateLiquidReserves(prisma, userId);
    if (totalDeductibles.gt(liquidReserves)) {
      signals.push({
        capabilityId: 'insurance-deductibles',
        type: 'warning',
        magnitude: -3,
        pillar: 'protection',
        summary: `Recorded deductibles total $${totalDeductibles.toFixed(2)}, above $${liquidReserves.toFixed(2)} in liquid reserves. This is an out-of-pocket resilience check, not an insurance adequacy assessment.`,
        weight: 1,
      });
    }
  }
  return signals;
}

/** Classifies a recorded renewal date without making an insurance-adequacy claim. */
export function insuranceRenewalSignal(
  policy: { type: string; provider: string; renewalDate: Date | null },
  now: Date,
): Signal | null {
  if (!policy.renewalDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilRenewal = Math.ceil(
    (policy.renewalDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const policyName = `${policy.provider} ${policy.type.toLowerCase().replace('_', ' ')}`;
  if (daysUntilRenewal < 0)
    return {
      capabilityId: 'insurance',
      type: 'risk',
      magnitude: -6,
      pillar: 'protection',
      summary: `${policyName} shows a renewal date that has passed. Confirm the policy is active.`,
      weight: 1,
    };
  if (daysUntilRenewal <= 30)
    return {
      capabilityId: 'insurance',
      type: 'warning',
      magnitude: -3,
      pillar: 'protection',
      summary: `${policyName} renews in ${daysUntilRenewal} days. Review the policy before it renews.`,
      weight: 1,
    };
  return null;
}

async function calculateLiquidReserves(prisma: PrismaClient, userId: string): Promise<Decimal> {
  const liquidTypes: AccountType[] = [AccountType.CHECKING, AccountType.SAVINGS, AccountType.CASH];
  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false, type: { in: liquidTypes } },
    include: { transactions: true, linkedBankAccounts: { select: { id: true } } },
  });
  return accounts.reduce((total, account) => {
    const balance =
      account.linkedBankAccounts.length > 0
        ? new Decimal(account.initialBalance.toString())
        : calculateBalance(
            new Decimal(account.initialBalance.toString()),
            account.transactions.map((tx): Transaction => ({
              id: tx.id,
              userId: tx.userId,
              accountId: tx.accountId,
              categoryId: tx.categoryId,
              date: tx.date,
              amount: tx.amount.toString(),
              type: tx.type as unknown as TransactionType,
              status: tx.status as unknown as TransactionStatus,
              merchant: tx.merchant,
              description: tx.description,
              notes: tx.notes,
              isReconciliation: tx.isReconciliation,
              aiCategorized: tx.aiCategorized,
              aiConfidence: tx.aiConfidence?.toString() ?? null,
              createdAt: tx.createdAt,
              updatedAt: tx.updatedAt,
            })),
          );
    return balance.gt(0) ? total.add(balance) : total;
  }, new Decimal(0));
}

/**
 * Generates signals based on emergency fund coverage.
 * Compares liquid savings to average monthly expenses to determine
 * how many months the household could sustain without income.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of emergency-fund signals
 */
async function generateEmergencyFundSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const totalLiquid = await calculateLiquidReserves(prisma, userId);

  // TransactionType.TRANSFER records are excluded structurally. The burn-rate
  // helper additionally removes common imported transfers mislabeled as debits.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const debitTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.DEBIT,
      date: { gte: ninetyDaysAgo },
    },
    include: { category: { select: { name: true } } },
  });

  const burnRate = calculateHouseholdBurnRate(
    debitTransactions.map((transaction) => ({
      amount: transaction.amount.toString(),
      categoryName: transaction.category?.name,
      merchant: transaction.merchant,
      description: transaction.description,
    })),
  );
  const monthlyExpenses = burnRate.essentialMonthly;

  if (monthlyExpenses.isZero()) {
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'warning',
      magnitude: -5,
      pillar: 'protection',
      summary: `Wardkeep found $${totalLiquid.toFixed(2)} in liquid savings but cannot calculate coverage without ordinary expense history.`,
      weight: 1,
    });
    return signals;
  }

  const monthsCoverage = totalLiquid.div(monthlyExpenses);
  // A linear curve keeps incremental progress visible: 0 / 1 / 3 / 6 / 12
  // months map to roughly 10 / 18 / 33 / 55 / 100, respectively.
  const cappedMonths = Decimal.min(monthsCoverage, MAXIMUM_MONTHS);
  const readiness = cappedMonths.div(MAXIMUM_MONTHS).mul(90).add(10);
  const magnitude = readiness.sub(100).div(10).toNumber();
  const targetMonths = monthsCoverage.lt(MINIMUM_MONTHS) ? MINIMUM_MONTHS : 6;
  const amountNeeded = Decimal.max(0, new Decimal(targetMonths).sub(monthsCoverage))
    .mul(monthlyExpenses)
    .toFixed(2);
  const type = readiness.gte(75) ? 'positive' : readiness.gte(45) ? 'warning' : 'risk';
  const targetText = monthsCoverage.gte(6)
    ? `A ${MAXIMUM_MONTHS}-month reserve is the maximum readiness benchmark.`
    : `$${amountNeeded} more reaches the ${targetMonths}-month milestone.`;

  signals.push({
    capabilityId: 'emergency-fund',
    type,
    magnitude,
    pillar: 'protection',
    summary: `Liquid reserves cover ${monthsCoverage.toFixed(1)} months of ${burnRate.usesNormalFallback ? 'ordinary' : 'essential'} expenses${burnRate.usesNormalFallback ? ' (essential expenses are not categorized yet)' : ''}. ${targetText}`,
    weight: 2,
  });

  return signals;
}
