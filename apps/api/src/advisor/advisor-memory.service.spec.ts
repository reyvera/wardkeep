import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdvisorMemoryService } from './advisor-memory.service';

describe('AdvisorMemoryService', () => {
  it('lists only unexpired memory for one household', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new AdvisorMemoryService({
      advisorMemory: { findMany, deleteMany },
      recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);
    const now = new Date('2026-09-07T00:00:00.000Z');
    await service.list('household-1', now);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'household-1', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }));
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'household-1', expiresAt: { lte: now } },
    });
  });

  it('does not delete another household’s memory', async () => {
    const service = new AdvisorMemoryService({
      advisorMemory: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as never);
    await expect(service.remove('household-1', 'memory-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records a confirmed annual bill once as a source-linked local event', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'memory-1' });
    const service = new AdvisorMemoryService({
      advisorMemory: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
      recurringTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'bill-1', merchant: 'Annual policy', nextExpected: new Date('2027-01-01') },
        ]),
      },
    } as never);

    await service.list('household-1');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: 'ANNUAL_EVENT', sourceRefs: ['recurring:bill-1'] }),
    }));
  });

  it('removes an automatic annual event when its recurring source is no longer active', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'memory-1', sourceRefs: ['recurring:inactive-bill'] }])
      .mockResolvedValueOnce([]);
    const service = new AdvisorMemoryService({
      advisorMemory: { deleteMany, findMany },
      recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);

    await service.list('household-1');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'household-1', id: { in: ['memory-1'] } },
    });
  });
});
