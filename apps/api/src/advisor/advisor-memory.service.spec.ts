import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdvisorMemoryService } from './advisor-memory.service';

describe('AdvisorMemoryService', () => {
  it('lists only unexpired memory for one household', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new AdvisorMemoryService({ advisorMemory: { findMany } } as never);
    const now = new Date('2026-09-07T00:00:00.000Z');
    await service.list('household-1', now);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'household-1', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }));
  });

  it('does not delete another household’s memory', async () => {
    const service = new AdvisorMemoryService({
      advisorMemory: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as never);
    await expect(service.remove('household-1', 'memory-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
