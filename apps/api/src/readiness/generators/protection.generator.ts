import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';

import { calculateBalance } from '@wardkeep/finance-engine';
import { TransactionType } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';

/** Recommended emergency fund coverage in months. */
const RECOMMENDED_MONTHS = 6;
const MINIMUM_MONTHS = 3;

/**
 * Generates readiness signals for the Protection pillar.
 * Covers: emergency fund coverage relative to monthly expenses.
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
  const liquidTypes = ['CHECKING', 'SAVINGS', 'CASH'];
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

  // Calculate average monthly expenses from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const debitTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.DEBIT,
      date: { gte: ninetyDaysAgo },
    },
  });

  const totalExpenses90Days = debitTransactions.reduce(
    (sum, tx) => sum.add(new Decimal(tx.amount.toString())),
    new Decimal(0),
  );

  const monthlyExpenses = totalExpenses90Days.div(3); // 90 days ≈ 3 months

  if (monthlyExpenses.isZero()) {
    // No expenses tracked — can't determine coverage
    if (totalLiquid.gt(0)) {
      signals.push({
        capabilityId: 'emergency-fund',
        type: 'positive',
        magnitude: 2,
        pillar: 'protection',
        summary: `$${totalLiquid.toFixed(2)} in liquid savings. Track expenses to calculate months of coverage.`,
        weight: 0.5,
      });
    }
    return signals;
  }

  const monthsCoverage = totalLiquid.div(monthlyExpenses);

  if (monthsCoverage.gte(RECOMMENDED_MONTHS)) {
    // Excellent: 6+ months coverage
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'positive',
      magnitude: 8,
      pillar: 'protection',
      summary: `Emergency fund covers ${monthsCoverage.toFixed(1)} months of expenses. Exceeds the ${RECOMMENDED_MONTHS}-month recommendation.`,
      weight: 2.0,
    });
  } else if (monthsCoverage.gte(MINIMUM_MONTHS)) {
    // Good: 3-6 months coverage
    const remaining = new Decimal(RECOMMENDED_MONTHS).sub(monthsCoverage);
    const amountNeeded = remaining.mul(monthlyExpenses).toFixed(2);
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'positive',
      magnitude: 4,
      pillar: 'protection',
      summary: `Emergency fund covers ${monthsCoverage.toFixed(1)} months. $${amountNeeded} more reaches the ${RECOMMENDED_MONTHS}-month goal.`,
      weight: 1.5,
    });
  } else if (monthsCoverage.gte(1)) {
    // Warning: 1-3 months coverage
    const amountNeeded = new Decimal(MINIMUM_MONTHS).sub(monthsCoverage).mul(monthlyExpenses).toFixed(2);
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'warning',
      magnitude: -4,
      pillar: 'protection',
      summary: `Emergency fund covers only ${monthsCoverage.toFixed(1)} months. $${amountNeeded} more reaches the ${MINIMUM_MONTHS}-month minimum.`,
      weight: 1.5,
    });
  } else if (monthsCoverage.gt(0)) {
    // Risk: less than 1 month coverage
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'risk',
      magnitude: -7,
      pillar: 'protection',
      summary: `Emergency fund covers less than 1 month of expenses. A single unexpected event could cause financial hardship.`,
      weight: 2.0,
    });
  } else {
    // Critical: zero or negative liquid savings
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'risk',
      magnitude: -9,
      pillar: 'protection',
      summary: 'No emergency fund. Any unexpected expense requires taking on debt.',
      weight: 2.5,
    });
  }

  return signals;
}
