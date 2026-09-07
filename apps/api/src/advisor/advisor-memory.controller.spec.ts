import { BadRequestException } from '@nestjs/common';
import { AdvisorMemoryKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AdvisorMemoryController } from './advisor-memory.controller';

describe('AdvisorMemoryController', () => {
  it('keeps created memory scoped to the authenticated household', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'memory-1' });
    const controller = new AdvisorMemoryController({ create } as never);
    await expect(controller.create({ userId: 'household-1' } as never, {
      kind: AdvisorMemoryKind.USER_PREFERENCE,
      summary: 'Prefer a monthly review.',
      sourceRefs: ['settings:review-cadence'],
    })).resolves.toEqual({ id: 'memory-1' });
    expect(create).toHaveBeenCalledWith('household-1', expect.objectContaining({
      kind: AdvisorMemoryKind.USER_PREFERENCE,
      summary: 'Prefer a monthly review.',
    }));
  });

  it('rejects malformed and backwards-expiring entries', () => {
    const controller = new AdvisorMemoryController({ create: vi.fn() } as never);
    expect(() => controller.create({ userId: 'household-1' } as never, {
      kind: AdvisorMemoryKind.ANNUAL_EVENT, summary: '',
    })).toThrow(BadRequestException);
    expect(() => controller.create({ userId: 'household-1' } as never, {
      kind: AdvisorMemoryKind.ANNUAL_EVENT, summary: 'Tax date',
      observedAt: '2026-09-02T00:00:00.000Z', expiresAt: '2026-09-01T00:00:00.000Z',
    })).toThrow(BadRequestException);
  });

  it('does not accept a manually invented recommendation outcome or seasonal pattern', () => {
    const controller = new AdvisorMemoryController({ create: vi.fn() } as never);
    expect(() => controller.create({ userId: 'household-1' } as never, {
      kind: AdvisorMemoryKind.RECOMMENDATION_OUTCOME, summary: 'I dismissed a suggestion.',
    })).toThrow(BadRequestException);
    expect(() => controller.create({ userId: 'household-1' } as never, {
      kind: AdvisorMemoryKind.SEASONAL_PATTERN, summary: 'Summer spending rises.',
    })).toThrow(BadRequestException);
  });
});
