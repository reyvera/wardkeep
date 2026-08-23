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
      })),
      ...policies.map((record) => ({
        id: `policy-${record.id}`,
        kind: 'POLICY_RENEWAL' as const,
        date: record.renewalDate!,
        title: `${record.provider} ${record.type.toLowerCase().replace('_', ' ')} renewal`,
        detail: 'Recorded policy renewal',
        href: '/insurance',
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
        };
      }),
    ].sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  private currency(value: string) {
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
