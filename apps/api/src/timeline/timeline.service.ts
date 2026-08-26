import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type TimelineEventKind = 'RECURRING_BILL' | 'POLICY_RENEWAL' | 'INCOME' | 'PLANNED_EXPENSE';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  date: Date;
  title: string;
  detail: string;
  href: string;
  actionRequired: boolean;
}

export interface TimelineHistoryEvent extends TimelineEvent {
  /** The date was recorded in Wardkeep; it does not confirm the underlying event occurred. */
  status: 'RECORDED_PAST';
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async listUpcoming(userId: string, requestedDays?: number): Promise<TimelineEvent[]> {
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays!, 1), 365) : 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const [recurring, policies, income, plannedExpenses] = await Promise.all([
      this.prisma.recurringTransaction.findMany({
        where: {
          userId,
          isConfirmed: true,
          isActive: true,
          nextExpected: { gte: start, lte: end },
        },
        orderBy: { nextExpected: 'asc' },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { userId, isActive: true, renewalDate: { gte: start, lte: end } },
        orderBy: { renewalDate: 'asc' },
      }),
      this.prisma.incomeSource.findMany({
        where: { userId, isActive: true, nextExpectedDate: { gte: start, lte: end } },
        orderBy: { nextExpectedDate: 'asc' },
      }),
      this.prisma.plannedExpense.findMany({
        where: { userId, isActive: true, dueDate: { gte: start, lte: end } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    return [
      ...recurring.map((record) => ({
        id: `recurring-${record.id}`,
        kind: 'RECURRING_BILL' as const,
        date: record.nextExpected,
        title: record.merchant,
        detail: `${this.currency(record.expectedAmount.toString())} expected ${record.frequency.toLowerCase()}`,
        href: '/recurring',
        actionRequired: false,
      })),
      ...policies.map((record) => ({
        id: `policy-${record.id}`,
        kind: 'POLICY_RENEWAL' as const,
        date: record.renewalDate!,
        title: `${record.provider} ${record.type.toLowerCase().replace('_', ' ')} renewal`,
        detail: 'Recorded policy renewal',
        href: '/insurance',
        actionRequired: true,
      })),
      ...income.map((record) => ({
        id: `income-${record.id}`,
        kind: 'INCOME' as const,
        date: record.nextExpectedDate!,
        title: record.name,
        detail: record.expectedNetAmount
          ? `${this.currency(record.expectedNetAmount.toString())} expected income`
          : 'Recorded expected income date',
        href: '/income-sources',
        actionRequired: false,
      })),
      ...plannedExpenses.map((record) => {
        const amount = record.amount?.toString();
        const funded = Number(record.fundedAmount?.toString() ?? 0);
        const shortfall = amount ? Math.max(Number(amount) - funded, 0) : null;
        return {
          id: `planned-${record.id}`,
          kind: 'PLANNED_EXPENSE' as const,
          date: record.dueDate!,
          title: record.name,
          detail: amount
            ? `${this.currency(amount)} planned${shortfall ? ` · ${this.currency(shortfall.toString())} not marked set aside` : ''}`
            : 'Recorded planned expense',
          href: '/planned-expenses',
          actionRequired: shortfall !== null && shortfall > 0,
        };
      }),
    ].sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  /**
   * Lists dates that are already past in source records. These deliberately use
   * a neutral status: Wardkeep cannot infer that a payment, renewal, or income
   * event actually occurred from a scheduled date alone.
   */
  async listHistory(userId: string, requestedDays?: number): Promise<TimelineHistoryEvent[]> {
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays!, 1), 365) : 30;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const [policies, income, plannedExpenses] = await Promise.all([
      this.prisma.insurancePolicy.findMany({
        where: { userId, renewalDate: { gte: start, lt: end } },
        orderBy: { renewalDate: 'desc' },
      }),
      this.prisma.incomeSource.findMany({
        where: { userId, nextExpectedDate: { gte: start, lt: end } },
        orderBy: { nextExpectedDate: 'desc' },
      }),
      this.prisma.plannedExpense.findMany({
        where: { userId, dueDate: { gte: start, lt: end } },
        orderBy: { dueDate: 'desc' },
      }),
    ]);

    return [
      ...policies.map((record) => ({
        id: `policy-${record.id}-${record.renewalDate!.toISOString()}`,
        kind: 'POLICY_RENEWAL' as const,
        date: record.renewalDate!,
        title: `${record.provider} ${record.type.toLowerCase().replace('_', ' ')} renewal`,
        detail: 'Recorded renewal date; confirm the policy status in Insurance.',
        href: '/insurance',
        actionRequired: true,
        status: 'RECORDED_PAST' as const,
      })),
      ...income.map((record) => ({
        id: `income-${record.id}-${record.nextExpectedDate!.toISOString()}`,
        kind: 'INCOME' as const,
        date: record.nextExpectedDate!,
        title: record.name,
        detail: 'Recorded expected income date; Wardkeep does not confirm receipt.',
        href: '/income-sources',
        actionRequired: false,
        status: 'RECORDED_PAST' as const,
      })),
      ...plannedExpenses.map((record) => ({
        id: `planned-${record.id}-${record.dueDate!.toISOString()}`,
        kind: 'PLANNED_EXPENSE' as const,
        date: record.dueDate!,
        title: record.name,
        detail: 'Recorded planned-expense date; review whether it was completed or rescheduled.',
        href: '/planned-expenses',
        actionRequired: true,
        status: 'RECORDED_PAST' as const,
      })),
    ].sort((left, right) => right.date.getTime() - left.date.getTime());
  }

  private currency(value: string) {
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
