import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { CapabilitiesService } from './capabilities.service';
import { FinanceCapability } from './finance.capability';

const createService = () => {
  const prisma = {
    capabilitySetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  } as unknown as PrismaService;
  const service = new CapabilitiesService(prisma, new FinanceCapability(prisma));
  service.onModuleInit();
  return { prisma, service };
};

describe('CapabilitiesService', () => {
  it('registers the core capabilities at startup and enables them by default', async () => {
    const { prisma, service } = createService();
    vi.mocked(prisma.capabilitySetting.findMany).mockResolvedValue([]);

    const capabilities = await service.listForUser('user-1');

    expect(capabilities.map((capability) => capability.id)).toContain('vehicle');
    expect(capabilities.every((capability) => capability.isEnabled)).toBe(true);
  });

  it('persists a household override when disabling a registered capability', async () => {
    const { prisma, service } = createService();
    vi.mocked(prisma.capabilitySetting.upsert).mockResolvedValue({ isEnabled: false } as never);

    await expect(service.disable('user-1', 'vehicle')).resolves.toMatchObject({ id: 'vehicle', isEnabled: false });
    expect(prisma.capabilitySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_capabilityId: { userId: 'user-1', capabilityId: 'vehicle' } },
      create: { userId: 'user-1', capabilityId: 'vehicle', isEnabled: false },
    }));
  });

  it('rejects lifecycle changes for an unknown capability', async () => {
    const { service } = createService();

    await expect(service.enable('user-1', 'not-registered')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes downstream only signals from capabilities the household has enabled', async () => {
    const { prisma, service } = createService();
    vi.mocked(prisma.capabilitySetting.findMany).mockResolvedValue([
      { capabilityId: 'vehicle', isEnabled: false },
    ] as never);

    const signals = await service.publishedSignalsForUser('user-1', [
      { capabilityId: 'vehicle-maintenance' },
      { capabilityId: 'budgets' },
    ]);

    expect(signals).toEqual([{ capabilityId: 'budgets' }]);
  });
});
