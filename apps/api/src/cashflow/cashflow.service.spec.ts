import { NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import { CashflowService } from './cashflow.service';

describe('CashflowService one-time events', () => {
  it('persists a future debit instead of keeping it only in process memory', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'event-1',
      accountId: 'account-1',
      date: new Date('2026-10-01T00:00:00.000Z'),
      amount: new Decimal('125.50'),
      type: 'DEBIT',
      description: 'Vehicle registration',
    });
    const prisma = {
      account: { findFirst: vi.fn().mockResolvedValue({ id: 'account-1' }) },
      cashflowEvent: { create },
    };
    const service = new CashflowService(prisma as never);

    await expect(
      service.addOneTimeEvent('household-1', {
        accountId: 'account-1',
        date: '2026-10-01T00:00:00.000Z',
        amount: '125.50',
        type: 'debit',
        description: 'Vehicle registration',
      }),
    ).resolves.toMatchObject({ id: 'event-1', amount: '125.50', type: 'debit' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'household-1',
        accountId: 'account-1',
        amount: new Decimal('125.50'),
        type: 'DEBIT',
      }),
    });
  });

  it('does not create an event in another household account', async () => {
    const create = vi.fn();
    const prisma = {
      account: { findFirst: vi.fn().mockResolvedValue(null) },
      cashflowEvent: { create },
    };
    const service = new CashflowService(prisma as never);

    await expect(
      service.addOneTimeEvent('household-1', {
        accountId: 'account-2',
        date: '2026-10-01T00:00:00.000Z',
        amount: '125.50',
        type: 'debit',
        description: 'Vehicle registration',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('only removes events owned by the current household', async () => {
    const remove = vi.fn();
    const prisma = {
      cashflowEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: remove,
      },
    };
    const service = new CashflowService(prisma as never);

    await expect(service.removeOneTimeEvent('household-1', 'event-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('only updates a future event owned by the current household', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 'event-1', accountId: 'account-1', date: new Date('2026-10-02T00:00:00.000Z'),
      amount: new Decimal('225.50'), type: 'CREDIT', description: 'Reimbursement',
    });
    const prisma = {
      cashflowEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1' }), update },
    };
    const service = new CashflowService(prisma as never);

    await expect(service.updateOneTimeEvent('household-1', 'event-1', {
      date: '2026-10-02T00:00:00.000Z', amount: '225.50', type: 'credit', description: 'Reimbursement',
    })).resolves.toMatchObject({ id: 'event-1', type: 'credit', amount: '225.50' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({ amount: new Decimal('225.50'), type: 'CREDIT' }),
    });
    expect(prisma.cashflowEvent.findFirst).toHaveBeenCalledWith({
      where: { id: 'event-1', userId: 'household-1', isActive: true },
      select: { id: true },
    });
  });

  it('only resolves an active event owned by the current household', async () => {
    const update = vi.fn();
    const prisma = {
      cashflowEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1' }), update },
    };
    const service = new CashflowService(prisma as never);

    await expect(service.completeOneTimeEvent('household-1', 'event-1')).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({ isActive: false, completedAt: expect.any(Date) }),
    });
  });

  it('only reopens a resolved event owned by the current household', async () => {
    const update = vi.fn();
    const prisma = {
      cashflowEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1' }), update },
    };
    const service = new CashflowService(prisma as never);

    await expect(service.reopenOneTimeEvent('household-1', 'event-1')).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { isActive: true, completedAt: null },
    });
  });
});
