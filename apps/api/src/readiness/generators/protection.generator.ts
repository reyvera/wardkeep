import { Decimal } from 'decimal.js';
import { AccountType, PrismaClient } from '@prisma/client';

import { calculateBalance } from '@wardkeep/finance-engine';
import { TransactionType } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';

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
  signals.push(...emergencyFundSignals);

  return signals;
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

  // Get liquid account balances (savings and checking)
  const liquidTypes: AccountType[] = [AccountType.CHECKING, AccountType.SAVINGS, AccountType.CASH];
  const liquidAccounts = await prisma.account.findMany({
    where: { userId, isArchived: false, type: { in: liquidTypes } },
    include: {
      transactions: true,
      linkedBankAccounts: { select: { id: true } },
    },
  });

  let totalLiquid = new Decimal(0);
  for (const account of liquidAccounts) {
    let balance: Decimal;
    if (account.linkedBankAccounts.length > 0) {
      balance = new Decimal(account.initialBalance.toString());
    } else {
      balance = calculateBalance(
        new Decimal(account.initialBalance.toString()),
        account.transactions.map((tx) => ({
          ...tx,
          amount: tx.amount.toString(),
          type: tx.type as unknown as TransactionType,
          aiConfidence: tx.aiConfidence?.toString() ?? null,
        })),
      );
    }
    // Only count positive balances toward emergency fund
    if (balance.gt(0)) {
      totalLiquid = totalLiquid.add(balance);
    }
  }

  // Calculate a sustainable burn rate from the last 90 days. TRANSFER records
  // are already excluded by the type filter; the keyword filter catches common
  // imported credit-card, investment, and savings transfers that are mislabelled
  // as debits. It is intentionally conservative: unknown transactions remain
  // included instead of silently understating the household's obligations.
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

  const transferLike = /(transfer|payment to|credit card payment|cc payment|investment|brokerage|savings transfer|principal payment)/i;
  const householdDebits = debitTransactions.filter((tx) => {
    const text = [tx.merchant, tx.description, tx.category?.name].filter(Boolean).join(' ');
    return !transferLike.test(text);
  });

  const totalExpenses90Days = householdDebits.reduce(
    (sum, tx) => sum.add(new Decimal(tx.amount.toString())),
    new Decimal(0),
  );

  const monthlyExpenses = totalExpenses90Days.div(3); // 90 days ≈ 3 months

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
    .mul(monthlyExpenses).toFixed(2);
  const type = readiness.gte(75) ? 'positive' : readiness.gte(45) ? 'warning' : 'risk';
  const targetText = monthsCoverage.gte(6)
    ? `A ${MAXIMUM_MONTHS}-month reserve is the maximum readiness benchmark.`
    : `$${amountNeeded} more reaches the ${targetMonths}-month milestone.`;

  signals.push({
    capabilityId: 'emergency-fund',
    type,
    magnitude,
    pillar: 'protection',
    summary: `Liquid reserves cover ${monthsCoverage.toFixed(1)} months of ordinary expenses. ${targetText}`,
    weight: 2,
  });

  return signals;
}
