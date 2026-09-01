import { afterEach, describe, expect, it, vi } from 'vitest';

import { TimelineService } from './timeline.service';

const decimal = (value: string) => ({ toString: () => value });

afterEach(() => {
  vi.useRealTimers();
});

describe('TimelineService', () => {
  it('returns only recorded upcoming events in chronological order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const prisma = {
      recurringTransaction: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'bill',
              merchant: 'Electric',
              expectedAmount: decimal('112.4'),
              frequency: 'MONTHLY',
              nextExpected: new Date('2026-08-27T00:00:00.000Z'),
            },
          ]),
      },
      insurancePolicy: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'policy',
              provider: 'State Farm',
              type: 'AUTO',
              renewalDate: new Date('2026-08-25T00:00:00.000Z'),
            },
          ]),
      },
      incomeSource: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'income',
              name: 'Salary',
              expectedNetAmount: decimal('2500'),
              nextExpectedDate: new Date('2026-08-26T00:00:00.000Z'),
            },
          ]),
      },
      plannedExpense: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'planned',
              name: 'Registration',
              amount: decimal('400'),
              fundedAmount: decimal('125'),
              dueDate: new Date('2026-08-28T00:00:00.000Z'),
            },
          ]),
      },
      savedPayoffPlan: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'plan',
            name: 'Debt freedom',
            strategy: 'avalanche',
            totalMonths: 1,
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
          },
        ]),
      },
      budget: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'budget', month: new Date('2026-08-01T00:00:00.000Z') },
        ]),
      },
      financialGoal: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'goal',
            name: 'Family vacation',
            targetAmount: decimal('3000'),
            savedAmount: decimal('1200'),
            targetDate: new Date('2026-08-29T00:00:00.000Z'),
          },
        ]),
      },
      vehicleMaintenance: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'maintenance',
            name: 'Oil change',
            dueDate: new Date('2026-08-30T00:00:00.000Z'),
            dueMileage: 32500,
            estimatedCost: decimal('85'),
            vehicle: { year: 2022, make: 'Honda', model: 'CR-V' },
          },
        ]),
      },
      homeMaintenanceTask: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new TimelineService(prisma as never);

    const events = await service.listUpcoming('user-1', 30);

    expect(events.map((event) => event.kind)).toEqual([
      'POLICY_RENEWAL',
      'INCOME',
      'RECURRING_BILL',
      'PLANNED_EXPENSE',
      'FINANCIAL_GOAL',
      'VEHICLE_MAINTENANCE',
      'BUDGET_PERIOD',
      'DEBT_PAYOFF',
    ]);
    expect(events[3]).toMatchObject({ detail: '$400.00 planned · $275.00 not marked set aside' });
    expect(events.filter((event) => event.actionRequired).map((event) => event.kind)).toEqual([
      'POLICY_RENEWAL',
      'PLANNED_EXPENSE',
      'VEHICLE_MAINTENANCE',
    ]);
    expect(events.find((event) => event.kind === 'DEBT_PAYOFF')).toMatchObject({
      title: 'Debt freedom projected payoff',
      href: '/debt',
      pillar: 'prosperity',
    });
    expect(events.find((event) => event.id === 'budget-end-budget')).toMatchObject({
      title: 'August budget ends',
      href: '/budget',
    });
    expect(events.find((event) => event.kind === 'FINANCIAL_GOAL')).toMatchObject({
      title: 'Family vacation target date',
      detail: '$1,200.00 of $3,000.00 recorded toward this goal.',
      href: '/financial-goals',
    });
    expect(events.find((event) => event.kind === 'VEHICLE_MAINTENANCE')).toMatchObject({
      title: '2022 Honda CR-V · Oil change',
      detail: '32,500 mi reminder · $85.00 estimated',
      href: '/vehicles',
    });
    expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', isConfirmed: true, isActive: true }),
      }),
    );
  });

  it('labels past source dates without inferring that the underlying event happened', async () => {
    const prisma = {
      insurancePolicy: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'policy',
            provider: 'State Farm',
            type: 'AUTO',
            renewalDate: new Date('2026-08-20T00:00:00.000Z'),
          },
        ]),
      },
      incomeSource: { findMany: vi.fn().mockResolvedValue([]) },
      plannedExpense: { findMany: vi.fn().mockResolvedValue([]) },
      financialGoal: { findMany: vi.fn().mockResolvedValue([]) },
      vehicleMaintenance: { findMany: vi.fn().mockResolvedValue([]) },
      homeMaintenanceTask: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new TimelineService(prisma as never);

    const events = await service.listHistory('user-1', 30);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'POLICY_RENEWAL',
      status: 'RECORDED_PAST',
      detail: 'Recorded renewal date; confirm the policy status in Insurance.',
    });
    expect(prisma.insurancePolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });

  it('merges past and upcoming records into chronological order for the unified feed', async () => {
    const service = new TimelineService({} as never);
    vi.spyOn(service, 'listHistory').mockResolvedValue([
      {
        id: 'past',
        kind: 'INCOME',
        pillar: 'protection',
        date: new Date('2026-08-20T00:00:00.000Z'),
        title: 'Past record',
        detail: 'Recorded date',
        href: '/income-sources',
        actionRequired: false,
        status: 'RECORDED_PAST',
      },
    ]);
    vi.spyOn(service, 'listUpcoming').mockResolvedValue([
      {
        id: 'future',
        kind: 'INCOME',
        pillar: 'protection',
        date: new Date('2026-08-27T00:00:00.000Z'),
        title: 'Future record',
        detail: 'Recorded date',
        href: '/income-sources',
        actionRequired: false,
      },
    ]);

    const events = await service.list('user-1', 30);

    expect(events.map((event) => event.id)).toEqual(['past', 'future']);
  });
});
