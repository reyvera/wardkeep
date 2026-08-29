import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { HouseholdTransitionsService } from './household-transitions.service';

describe('HouseholdTransitionsService readiness check', () => {
  it('reports only recorded household facts and identifies missing records', async () => {
    const count = vi.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const prisma = {
      account: { count }, insurancePolicy: { count }, recurringTransaction: { count },
      estateDocument: { count }, householdTransitionPlan: { count },
    } as unknown as PrismaService;

    await expect(new HouseholdTransitionsService(prisma).readinessCheck('household-1')).resolves.toMatchObject({
      recordedCount: 3,
      totalCount: 5,
      checks: expect.arrayContaining([
        expect.objectContaining({ id: 'accounts', recorded: true }),
        expect.objectContaining({ id: 'insurance', recorded: false }),
      ]),
    });
  });
});
