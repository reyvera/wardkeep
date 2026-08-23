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
    };
    const service = new TimelineService(prisma as never);

    const events = await service.listUpcoming('user-1', 30);

    expect(events.map((event) => event.kind)).toEqual([
      'POLICY_RENEWAL',
      'INCOME',
      'RECURRING_BILL',
      'PLANNED_EXPENSE',
    ]);
    expect(events[3]).toMatchObject({ detail: '$400.00 planned · $275.00 not marked set aside' });
    expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', isConfirmed: true, isActive: true }),
      }),
    );
  });
});
