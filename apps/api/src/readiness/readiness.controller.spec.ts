import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ReadinessController } from './readiness.controller';

describe('ReadinessController cash-reserve scenario', () => {
  it('passes a bounded temporary reserve amount to the authenticated household service', async () => {
    const readiness = { getCashReserveScenario: vi.fn().mockResolvedValue({ scenario: {} }) };
    const controller = new ReadinessController(readiness as never, {} as never);

    await expect(
      controller.getCashReserveScenario({ userId: 'household-1' } as never, {
        proposedReserves: '12500.5',
      }),
    ).resolves.toEqual({ scenario: {} });
    expect(readiness.getCashReserveScenario).toHaveBeenCalledWith('household-1', '12500.50');
  });

  it('rejects negative, non-finite, and implausibly large reserve values', () => {
    const controller = new ReadinessController({} as never, {} as never);
    for (const proposedReserves of [-1, 'NaN', 100_000_001]) {
      expect(() =>
        controller.getCashReserveScenario({ userId: 'household-1' } as never, { proposedReserves }),
      ).toThrow(BadRequestException);
    }
  });

  it('passes a bounded temporary recurring-bill total to the authenticated household service', async () => {
    const readiness = { getRecurringObligationScenario: vi.fn().mockResolvedValue({ scenario: {} }) };
    const controller = new ReadinessController(readiness as never, {} as never);

    await expect(
      controller.getRecurringObligationScenario({ userId: 'household-1' } as never, {
        proposedMonthlyRecurringBills: '2100.25',
      }),
    ).resolves.toEqual({ scenario: {} });
    expect(readiness.getRecurringObligationScenario).toHaveBeenCalledWith('household-1', '2100.25');
  });

  it('passes a bounded temporary debt-minimum total to the authenticated household service', async () => {
    const readiness = { getDebtMinimumScenario: vi.fn().mockResolvedValue({ scenario: {} }) };
    const controller = new ReadinessController(readiness as never, {} as never);

    await expect(
      controller.getDebtMinimumScenario({ userId: 'household-1' } as never, {
        proposedMonthlyDebtMinimums: '875',
      }),
    ).resolves.toEqual({ scenario: {} });
    expect(readiness.getDebtMinimumScenario).toHaveBeenCalledWith('household-1', '875.00');
  });
});
