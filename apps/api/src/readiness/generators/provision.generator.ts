import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';

import {
  calculateBalance,
  calculateBudgetSummary,
  projectCashFlow,
  CashFlowAccount,
} from '@wardkeep/finance-engine';
import { TransactionType, RecurrenceFrequency } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';

/**
 * Generates readiness signals for the Provision pillar.
 * Covers: budget adherence, cash flow runway, and upcoming bill coverage.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of readiness signals for the provision pillar
 */
export async function generateProvisionSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const budgetSignals = await generateBudgetAdherenceSignals(prisma, userId);
  const cashFlowSignals = await generateCashFlowSignals(prisma, userId);
  const billSignals = await generateBillCoverageSignals(prisma, userId);

  signals.push(...budgetSignals, ...cashFlowSignals, ...billSignals);
  return signals;
}

/**
 * Generates signals based on budget adherence for the current month.
 * Produces risk signals when spending exceeds allocated amounts.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of budget-related signals
 */
async function generateBudgetAdherenceSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startOfMonth = new Date(Date.UTC(year, month, 1));
  const startOfNextMonth = new Date(Date.UTC(year, month + 1, 1));

  const budget = await prisma.budget.findUnique({
    where: { userId_month: { userId, month: startOfMonth } },
    include: { allocations: true },
  });

  if (!budget || budget.allocations.length === 0) {
    // No budget set up — mild opportunity signal
    signals.push({
      capabilityId: 'budgets',
      type: 'opportunity',
      magnitude: 2,
      pillar: 'provision',
      summary: 'No budget set for this month. Setting one improves spending awareness.',
      weight: 0.5,
    });
    return signals;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.DEBIT,
      date: { gte: startOfMonth, lt: startOfNextMonth },
    },
  });
  const refunds = await prisma.transaction.findMany({
    where: { userId, type: TransactionType.CREDIT, refundForTransactionId: { in: transactions.map((tx) => tx.id) } },
    select: { refundForTransactionId: true, amount: true },
  });
  const refundsByPurchase = new Map<string, Decimal>();
  for (const refund of refunds) if (refund.refundForTransactionId) refundsByPurchase.set(refund.refundForTransactionId, (refundsByPurchase.get(refund.refundForTransactionId) ?? new Decimal(0)).plus(refund.amount.toString()));

  const mappedBudget = {
    allocations: budget.allocations.map((a) => ({
      categoryId: a.categoryId,
      amount: new Decimal(a.amount.toString()).toFixed(2),
    })),
  };

  const mappedTransactions = transactions.map((tx) => ({
    id: tx.id,
    userId: tx.userId,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    date: tx.date,
    amount: new Decimal(tx.amount.toString()).minus(refundsByPurchase.get(tx.id) ?? 0).toFixed(2),
    type: tx.type as unknown as TransactionType,
    status: tx.status,
    merchant: tx.merchant,
    description: tx.description,
    notes: tx.notes,
    isReconciliation: tx.isReconciliation,
    aiCategorized: tx.aiCategorized,
    aiConfidence: tx.aiConfidence?.toString() ?? null,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  }));

  const summary = calculateBudgetSummary(mappedBudget, mappedTransactions);

  const totalAllocated = new Decimal(summary.totalAllocated);
  const totalSpent = new Decimal(summary.totalSpent);

  if (totalAllocated.isZero()) {
    return signals;
  }

  const adherenceRatio = totalSpent.div(totalAllocated);
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const expectedRatio = new Decimal(dayOfMonth).div(daysInMonth);

  // Compare actual spending pace to expected pace
  if (adherenceRatio.gt(new Decimal('1.0'))) {
    // Over budget
    const overPercent = adherenceRatio.sub(1).mul(100).toFixed(0);
    signals.push({
      capabilityId: 'budgets',
      type: 'risk',
      magnitude: -7,
      pillar: 'provision',
      summary: `Spending is ${overPercent}% over budget this month.`,
      weight: 1.5,
    });
  } else if (adherenceRatio.gt(expectedRatio.mul(new Decimal('1.2')))) {
    // Spending faster than pace (20% ahead of expected pace)
    signals.push({
      capabilityId: 'budgets',
      type: 'warning',
      magnitude: -3,
      pillar: 'provision',
      summary: 'Spending is ahead of budget pace for this point in the month.',
      weight: 1.0,
    });
  } else if (adherenceRatio.lt(expectedRatio.mul(new Decimal('0.8')))) {
    // Under budget pace — positive signal
    signals.push({
      capabilityId: 'budgets',
      type: 'positive',
      magnitude: 3,
      pillar: 'provision',
      summary: 'Spending is below budget pace — on track for a surplus this month.',
      weight: 1.0,
    });
  }

  // Overspent categories risk
  if (summary.overspentCount > 0) {
    const severity = Math.min(summary.overspentCount * 2, 8);
    signals.push({
      capabilityId: 'budgets',
      type: 'warning',
      magnitude: -severity,
      pillar: 'provision',
      summary: `${summary.overspentCount} budget ${summary.overspentCount === 1 ? 'category is' : 'categories are'} overspent.`,
      weight: 1.0,
    });
  }

  return signals;
}

/**
 * Generates signals based on cash flow projections across all accounts.
 * Flags accounts that will go below zero within 30 days.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of cash-flow-related signals
 */
async function generateCashFlowSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
    include: {
      transactions: true,
      linkedBankAccounts: { select: { id: true } },
    },
  });

  const recurringRecords = await prisma.recurringTransaction.findMany({
    where: { userId, isConfirmed: true, isActive: true },
  });

  let totalBelowZeroCount = 0;

  for (const account of accounts) {
    // Skip liability accounts
    const liabilityTypes = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC'];
    if (liabilityTypes.includes(account.type)) continue;

    let currentBalance: Decimal;
    if (account.linkedBankAccounts.length > 0) {
      currentBalance = new Decimal(account.initialBalance.toString());
    } else {
      currentBalance = calculateBalance(
        new Decimal(account.initialBalance.toString()),
        account.transactions.map((tx) => ({
          ...tx,
          amount: tx.amount.toString(),
          type: tx.type as unknown as TransactionType,
          aiConfidence: tx.aiConfidence?.toString() ?? null,
        })),
      );
    }

    const cashFlowAccount: CashFlowAccount = {
      id: account.id,
      name: account.name,
      currentBalance: currentBalance.toFixed(2),
    };

    const accountRecurring = recurringRecords
      .filter((r) => r.accountId === account.id)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        accountId: r.accountId,
        merchant: r.merchant,
        expectedAmount: r.expectedAmount.toString(),
        frequency: r.frequency as unknown as RecurrenceFrequency,
        nextExpected: r.nextExpected,
        isConfirmed: r.isConfirmed,
        isDismissed: r.isDismissed,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }));

    const result = projectCashFlow(cashFlowAccount, accountRecurring, []);

    // Count below-zero notifications within the next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const urgentNotifications = result.belowZeroNotifications.filter(
      (n) => new Date(n.date) <= thirtyDaysFromNow,
    );

    totalBelowZeroCount += urgentNotifications.length;
  }

  if (totalBelowZeroCount > 0) {
    signals.push({
      capabilityId: 'cashflow',
      type: 'risk',
      magnitude: -8,
      pillar: 'provision',
      summary: `Cash flow projection shows ${totalBelowZeroCount} ${totalBelowZeroCount === 1 ? 'account' : 'accounts'} going below zero within 30 days.`,
      weight: 2.0,
    });
  } else {
    signals.push({
      capabilityId: 'cashflow',
      type: 'positive',
      magnitude: 5,
      pillar: 'provision',
      summary: 'All accounts remain positive in the 30-day cash flow projection.',
      weight: 1.0,
    });
  }

  return signals;
}

/**
 * Generates signals based on whether upcoming bills can be covered.
 * Checks confirmed recurring bills due in the next 14 days against liquid account balances.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of bill-coverage signals
 */
async function generateBillCoverageSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const upcomingBills = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      isConfirmed: true,
      isActive: true,
      nextExpected: { lte: twoWeeksFromNow },
    },
  });

  if (upcomingBills.length === 0) {
    return signals;
  }

  const totalUpcoming = upcomingBills.reduce(
    (sum, bill) => sum.add(new Decimal(bill.expectedAmount.toString())),
    new Decimal(0),
  );

  // Get liquid account balances (checking, savings, cash)
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
    totalLiquid = totalLiquid.add(balance);
  }

  const coverageRatio = totalLiquid.isZero()
    ? new Decimal(0)
    : totalLiquid.div(totalUpcoming);

  if (coverageRatio.lt(new Decimal('1.0'))) {
    const shortfall = totalUpcoming.sub(totalLiquid).toFixed(2);
    signals.push({
      capabilityId: 'recurring',
      type: 'risk',
      magnitude: -9,
      pillar: 'provision',
      summary: `Upcoming bills exceed liquid balance by $${shortfall}. Bills may not be covered in the next 14 days.`,
      weight: 2.0,
    });
  } else if (coverageRatio.lt(new Decimal('2.0'))) {
    signals.push({
      capabilityId: 'recurring',
      type: 'warning',
      magnitude: -2,
      pillar: 'provision',
      summary: 'Liquid balance covers upcoming bills but with less than 2x buffer.',
      weight: 1.0,
    });
  } else {
    signals.push({
      capabilityId: 'recurring',
      type: 'positive',
      magnitude: 4,
      pillar: 'provision',
      summary: 'Upcoming bills are well-covered with comfortable liquid reserves.',
      weight: 1.0,
    });
  }

  return signals;
}
