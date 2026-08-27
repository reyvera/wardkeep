import { describe, expect, it, vi } from 'vitest';

import { TimelineService } from './timeline.service';

const decimal = (value: string) => ({ toString: () => value });

describe('TimelineService', () => {
  it('returns only recorded upcoming events in chronological order', async () => {
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
    };
    const service = new TimelineService(prisma as never);

    const events = await service.listUpcoming('user-1', 30);

    expect(events.map((event) => event.kind)).toEqual([
      'POLICY_RENEWAL',
      'INCOME',
      'RECURRING_BILL',
      'PLANNED_EXPENSE',
      'BUDGET_PERIOD',
      'DEBT_PAYOFF',
    ]);
    expect(events[3]).toMatchObject({ detail: '$400.00 planned · $275.00 not marked set aside' });
    expect(events.filter((event) => event.actionRequired).map((event) => event.kind)).toEqual([
      'POLICY_RENEWAL',
      'PLANNED_EXPENSE',
    ]);
    expect(events.find((event) => event.kind === 'DEBT_PAYOFF')).toMatchObject({
      title: 'Debt freedom projected payoff',
      href: '/debt',
    });
    expect(events.find((event) => event.id === 'budget-end-budget')).toMatchObject({
      title: 'August budget ends',
      href: '/budget',
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
