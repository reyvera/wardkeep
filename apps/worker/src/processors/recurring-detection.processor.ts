/**
 * Recurring transaction detection processor — analyzes transaction history
 * to identify recurring payment patterns (subscriptions, bills, etc.).
 */
import { Job } from 'bullmq';
import { PrismaClient, RecurrenceFrequency } from '@prisma/client';

const prisma = new PrismaClient();

interface RecurringDetectionJobData {
  userId: string;
}

interface TransactionGroup {
  merchant: string;
  accountId: string;
  transactions: { date: Date; amount: number }[];
}

/**
 * Detect recurring transaction patterns for a user.
 * Groups transactions by merchant + account, then checks for consistent amounts
 * and intervals to identify subscriptions and recurring bills.
 * @param job - BullMQ job containing userId.
 */
export async function processRecurringDetection(job: Job): Promise<void> {
  const { userId } = job.data as RecurringDetectionJobData;

  // Get all transactions with merchants for this user
  const transactions = await prisma.transaction.findMany({
    where: { userId, merchant: { not: null } },
    orderBy: { date: 'asc' },
    select: { id: true, merchant: true, accountId: true, date: true, amount: true },
  });

  // Group by merchant + account
  const groups = new Map<string, TransactionGroup>();
  for (const tx of transactions) {
    if (!tx.merchant) continue;
    const key = `${tx.accountId}|${tx.merchant.toLowerCase().trim()}`;
    const group = groups.get(key) ?? {
      merchant: tx.merchant,
      accountId: tx.accountId,
      transactions: [],
    };
    group.transactions.push({ date: tx.date, amount: Number(tx.amount) });
    groups.set(key, group);
  }

  // Get already dismissed patterns to suppress
  const dismissed = await prisma.recurringTransaction.findMany({
    where: { userId, isDismissed: true },
    select: { merchant: true, accountId: true },
  });
  const dismissedKeys = new Set(
    dismissed.map((d) => `${d.accountId}|${d.merchant.toLowerCase().trim()}`),
  );

  // Analyze each group for recurring patterns
  for (const [key, group] of groups.entries()) {
    if (dismissedKeys.has(key)) continue;
    if (group.transactions.length < 3) continue;

    // Check if amounts are within 10% of each other
    const amounts = group.transactions.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountsConsistent = amounts.every(
      (a) => Math.abs(a - avgAmount) / Math.abs(avgAmount) <= 0.1,
    );
    if (!amountsConsistent) continue;

    // Check if intervals are consistent (±3 days)
    const intervals: number[] = [];
    for (let i = 1; i < group.transactions.length; i++) {
      const prev = group.transactions[i - 1];
      const curr = group.transactions[i];
      if (!prev || !curr) continue;
      const diff = (curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(diff);
    }
    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalsConsistent = intervals.every((i) => Math.abs(i - avgInterval) <= 3);
    if (!intervalsConsistent) continue;

    // Detect frequency from average interval
    const frequency = detectFrequency(avgInterval);
    if (!frequency) continue;

    // Check if already detected (not dismissed, not confirmed)
    const existing = await prisma.recurringTransaction.findFirst({
      where: {
        userId,
        accountId: group.accountId,
        merchant: group.merchant,
        isDismissed: false,
      },
    });
    if (existing) continue;

    // Create detected pattern
    const lastTx = group.transactions[group.transactions.length - 1];
    if (!lastTx) continue;
    const nextExpected = addIntervalDays(lastTx.date, avgInterval);

    await prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: group.accountId,
        merchant: group.merchant,
        expectedAmount: avgAmount,
        frequency,
        nextExpected,
        isConfirmed: false,
        isDismissed: false,
        isActive: true,
      },
    });
  }
}

/**
 * Detect recurrence frequency from the average interval in days.
 * @param avgDays - Average days between occurrences.
 * @returns Frequency enum value or null if no pattern matches.
 */
function detectFrequency(avgDays: number): RecurrenceFrequency | null {
  if (avgDays >= 5 && avgDays <= 9) return RecurrenceFrequency.WEEKLY;
  if (avgDays >= 12 && avgDays <= 16) return RecurrenceFrequency.BIWEEKLY;
  if (avgDays >= 27 && avgDays <= 33) return RecurrenceFrequency.MONTHLY;
  if (avgDays >= 85 && avgDays <= 95) return RecurrenceFrequency.QUARTERLY;
  if (avgDays >= 175 && avgDays <= 190) return RecurrenceFrequency.SEMIANNUAL;
  if (avgDays >= 355 && avgDays <= 375) return RecurrenceFrequency.ANNUAL;
  return null;
}

/**
 * Calculate the next expected date by adding interval days.
 * @param date - Base date.
 * @param days - Number of days to add.
 * @returns New date with days added.
 */
function addIntervalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.round(days));
  return result;
}
