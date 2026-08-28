import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type TimelineEventKind =
  | 'RECURRING_BILL'
  | 'POLICY_RENEWAL'
  | 'INCOME'
  | 'PLANNED_EXPENSE'
  | 'DEBT_PAYOFF'
  | 'BUDGET_PERIOD'
  | 'FINANCIAL_GOAL'
  | 'VEHICLE_MAINTENANCE'
  | 'HOME_MAINTENANCE';
export type TimelinePillar = 'protection' | 'provision' | 'preparation' | 'prosperity';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  pillar: TimelinePillar;
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

export type UnifiedTimelineEvent = TimelineEvent | TimelineHistoryEvent;

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async listUpcoming(userId: string, requestedDays?: number): Promise<TimelineEvent[]> {
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays!, 1), 365) : 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const [recurring, policies, income, plannedExpenses, payoffPlans, budgets, goals, vehicleMaintenance, homeMaintenance] = await Promise.all([
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
      this.prisma.savedPayoffPlan.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.budget.findMany({
        where: { userId, month: { gte: new Date(start.getFullYear(), start.getMonth(), 1), lte: end } },
        orderBy: { month: 'asc' },
      }),
      this.prisma.financialGoal.findMany({
        where: { userId, isActive: true, targetDate: { gte: start, lte: end } },
        orderBy: { targetDate: 'asc' },
      }),
      this.prisma.vehicleMaintenance.findMany({
        where: { vehicle: { userId, isActive: true }, completedAt: null, dueDate: { gte: start, lte: end } },
        include: { vehicle: true },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.homeMaintenanceTask.findMany({ where: { userId, completedAt: null, dueDate: { gte: start, lte: end } }, include: { homeAsset: true }, orderBy: { dueDate: 'asc' } }),
    ]);

    return [
      ...recurring.map((record) => ({
        id: `recurring-${record.id}`,
        kind: 'RECURRING_BILL' as const,
        pillar: 'provision' as const,
        date: record.nextExpected,
        title: record.merchant,
        detail: `${this.currency(record.expectedAmount.toString())} expected ${record.frequency.toLowerCase()}`,
        href: '/recurring',
        actionRequired: false,
      })),
      ...policies.map((record) => ({
        id: `policy-${record.id}`,
        kind: 'POLICY_RENEWAL' as const,
        pillar: 'protection' as const,
        date: record.renewalDate!,
        title: `${record.provider} ${record.type.toLowerCase().replace('_', ' ')} renewal`,
        detail: 'Recorded policy renewal',
        href: '/insurance',
        actionRequired: true,
      })),
      ...income.map((record) => ({
        id: `income-${record.id}`,
        kind: 'INCOME' as const,
        pillar: 'protection' as const,
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
          pillar: 'preparation' as const,
          date: record.dueDate!,
          title: record.name,
          detail: amount
            ? `${this.currency(amount)} planned${shortfall ? ` · ${this.currency(shortfall.toString())} not marked set aside` : ''}`
            : 'Recorded planned expense',
          href: '/planned-expenses',
          actionRequired: shortfall !== null && shortfall > 0,
        };
      }),
      ...payoffPlans
        .map((plan) => {
          const date = new Date(plan.createdAt);
          date.setMonth(date.getMonth() + plan.totalMonths);
          return { plan, date };
        })
        .filter(({ date }) => date >= start && date <= end)
        .map(({ plan, date }) => ({
          id: `debt-payoff-${plan.id}`,
          kind: 'DEBT_PAYOFF' as const,
          pillar: 'prosperity' as const,
          date,
          title: `${plan.name} projected payoff`,
          detail: `Recorded ${plan.strategy} payoff plan projects debt freedom in ${plan.totalMonths} months; actual payoff depends on balances and payments.`,
          href: '/debt',
          actionRequired: false,
        })),
      ...budgets.flatMap((budget) => {
        const year = budget.month.getUTCFullYear();
        const month = budget.month.getUTCMonth();
        const periodStart = new Date(Date.UTC(year, month, 1));
        const periodEnd = new Date(Date.UTC(year, month + 1, 0));
        const monthName = periodStart.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        });
        return [
          {
            id: `budget-start-${budget.id}`,
            kind: 'BUDGET_PERIOD' as const,
            pillar: 'provision' as const,
            date: periodStart,
            title: `${monthName} budget begins`,
            detail: 'Recorded monthly budget period; review allocations as needed.',
            href: '/budget',
            actionRequired: false,
          },
          {
            id: `budget-end-${budget.id}`,
            kind: 'BUDGET_PERIOD' as const,
            pillar: 'provision' as const,
            date: periodEnd,
            title: `${monthName} budget ends`,
            detail: 'Recorded monthly budget period; this does not confirm a budget review occurred.',
            href: '/budget',
            actionRequired: false,
          },
        ].filter((event) => event.date >= start && event.date <= end);
      }),
      ...goals.map((goal) => ({
        id: `goal-${goal.id}`,
        kind: 'FINANCIAL_GOAL' as const,
        pillar: 'preparation' as const,
        date: goal.targetDate!,
        title: `${goal.name} target date`,
        detail: goal.targetAmount
          ? `${this.currency(goal.savedAmount.toString())} of ${this.currency(goal.targetAmount.toString())} recorded toward this goal.`
          : `${this.currency(goal.savedAmount.toString())} recorded toward this goal.`,
        href: '/financial-goals',
        actionRequired: false,
      })),
      ...vehicleMaintenance.map((record) => ({
        id: `vehicle-maintenance-${record.id}`,
        kind: 'VEHICLE_MAINTENANCE' as const,
        pillar: 'preparation' as const,
        date: record.dueDate!,
        title: `${record.vehicle.year ?? ''} ${record.vehicle.make} ${record.vehicle.model} · ${record.name}`.trim(),
        detail: `${record.dueMileage ? `${record.dueMileage.toLocaleString()} mi reminder` : 'Recorded maintenance reminder'}${record.estimatedCost ? ` · ${this.currency(record.estimatedCost.toString())} estimated` : ''}`,
        href: '/vehicles',
        actionRequired: true,
      })),
      ...homeMaintenance.map((record) => ({ id: `home-maintenance-${record.id}`, kind: 'HOME_MAINTENANCE' as const, pillar: 'preparation' as const, date: record.dueDate!, title: record.name, detail: `${record.homeAsset ? `${record.homeAsset.name} · ` : ''}recorded home-maintenance reminder${record.estimatedCost ? ` · ${this.currency(record.estimatedCost.toString())} estimated` : ''}`, href: '/home-maintenance', actionRequired: true })),
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
    const [policies, income, plannedExpenses, goals, vehicleMaintenance, homeMaintenance] = await Promise.all([
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
      this.prisma.financialGoal.findMany({
        where: { userId, targetDate: { gte: start, lt: end } },
        orderBy: { targetDate: 'desc' },
      }),
      this.prisma.vehicleMaintenance.findMany({
        where: { vehicle: { userId }, completedAt: null, dueDate: { gte: start, lt: end } },
        include: { vehicle: true },
        orderBy: { dueDate: 'desc' },
      }),
      this.prisma.homeMaintenanceTask.findMany({ where: { userId, completedAt: null, dueDate: { gte: start, lt: end } }, include: { homeAsset: true }, orderBy: { dueDate: 'desc' } }),
    ]);

    return [
      ...policies.map((record) => ({
        id: `policy-${record.id}-${record.renewalDate!.toISOString()}`,
        kind: 'POLICY_RENEWAL' as const,
        pillar: 'protection' as const,
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
        pillar: 'protection' as const,
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
        pillar: 'preparation' as const,
        date: record.dueDate!,
        title: record.name,
        detail: 'Recorded planned-expense date; review whether it was completed or rescheduled.',
        href: '/planned-expenses',
        actionRequired: true,
        status: 'RECORDED_PAST' as const,
      })),
      ...goals.map((goal) => ({
        id: `goal-${goal.id}-${goal.targetDate!.toISOString()}`,
        kind: 'FINANCIAL_GOAL' as const,
        pillar: 'preparation' as const,
        date: goal.targetDate!,
        title: `${goal.name} target date`,
        detail: 'Recorded goal target date; review whether the goal was achieved or needs a new date.',
        href: '/financial-goals',
        actionRequired: true,
        status: 'RECORDED_PAST' as const,
      })),
      ...vehicleMaintenance.map((record) => ({
        id: `vehicle-maintenance-${record.id}-${record.dueDate!.toISOString()}`,
        kind: 'VEHICLE_MAINTENANCE' as const,
        pillar: 'preparation' as const,
        date: record.dueDate!,
        title: `${record.vehicle.year ?? ''} ${record.vehicle.make} ${record.vehicle.model} · ${record.name}`.trim(),
        detail: 'Recorded maintenance reminder date; review whether the service was completed or rescheduled.',
        href: '/vehicles',
        actionRequired: true,
        status: 'RECORDED_PAST' as const,
      })),
      ...homeMaintenance.map((record) => ({ id: `home-maintenance-${record.id}-${record.dueDate!.toISOString()}`, kind: 'HOME_MAINTENANCE' as const, pillar: 'preparation' as const, date: record.dueDate!, title: record.name, detail: 'Recorded home-maintenance reminder date; review whether the task was completed or rescheduled.', href: '/home-maintenance', actionRequired: true, status: 'RECORDED_PAST' as const })),
    ].sort((left, right) => right.date.getTime() - left.date.getTime());
  }

  /** Combines past recorded dates and upcoming events into one chronological feed. */
  async list(userId: string, requestedDays?: number): Promise<UnifiedTimelineEvent[]> {
    const [history, upcoming] = await Promise.all([
      this.listHistory(userId, requestedDays),
      this.listUpcoming(userId, requestedDays),
    ]);
    return [...history, ...upcoming].sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  private currency(value: string) {
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
