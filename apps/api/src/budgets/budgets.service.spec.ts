import { describe, expect, it, vi } from 'vitest';
import { BudgetsService } from './budgets.service';

describe('BudgetsService rollover copy', () => {
  it('carries only an opted-in category’s unspent amount', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'new', userId: 'user', month: new Date('2026-09-01'), createdAt: new Date(), updatedAt: new Date(), allocations: [] });
    const prisma = { budget: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ allocations: [{ categoryId: 'food', amount: '500', rolloverEnabled: true, rolloverAmount: '25' }, { categoryId: 'fun', amount: '100', rolloverEnabled: false, rolloverAmount: '0' }] }), create }, category: { findMany: vi.fn().mockResolvedValue([{ id: 'food' }, { id: 'fun' }]) }, transaction: { findMany: vi.fn().mockResolvedValue([{ categoryId: 'food', amount: '300' }, { categoryId: 'fun', amount: '20' }]) } };
    await new BudgetsService(prisma as never).copyFromPreviousMonth('user', '2026-09');
    const allocations = create.mock.calls[0][0].data.allocations.create;
    expect(allocations).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: 'food', rolloverAmount: expect.anything() }), expect.objectContaining({ categoryId: 'fun', rolloverAmount: 0 })]));
    expect(allocations[0].rolloverAmount.toString()).toBe('225');
  });

  it('never carries a negative balance forward', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'new', userId: 'user', month: new Date(), createdAt: new Date(), updatedAt: new Date(), allocations: [] });
    const prisma = { budget: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ allocations: [{ categoryId: 'food', amount: '100', rolloverEnabled: true, rolloverAmount: '0' }] }), create }, category: { findMany: vi.fn().mockResolvedValue([{ id: 'food' }]) }, transaction: { findMany: vi.fn().mockResolvedValue([{ categoryId: 'food', amount: '150' }]) } };
    await new BudgetsService(prisma as never).copyFromPreviousMonth('user', '2026-09');
    expect(create.mock.calls[0][0].data.allocations.create[0].rolloverAmount.toString()).toBe('0');
  });
});
