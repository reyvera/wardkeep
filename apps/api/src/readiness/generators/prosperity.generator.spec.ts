import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import { calculateRecordedNetWorth, netWorthTrendSignal } from './prosperity.generator';

describe('netWorthTrendSignal', () => {
  it('recognizes three consecutive monthly increases using recorded net-worth history', () => {
    const signal = netWorthTrendSignal(
      new Decimal(14_000),
      [new Decimal(8_000), new Decimal(10_000), new Decimal(12_000)],
    );

    expect(signal).toMatchObject({ capabilityId: 'accounts', type: 'positive', magnitude: 6 });
    expect(signal?.summary).toContain('last three monthly comparisons');
  });

  it('does not present a flat or declining history as a three-month growth streak', () => {
    const signal = netWorthTrendSignal(
      new Decimal(12_000),
      [new Decimal(8_000), new Decimal(13_000), new Decimal(12_000)],
    );

    expect(signal).toMatchObject({ type: 'positive', magnitude: 4 });
    expect(signal?.summary).not.toContain('last three monthly comparisons');
  });
});

describe('calculateRecordedNetWorth', () => {
  it('uses a recorded property value once and keeps its mortgage as a liability', async () => {
    const prisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          {
            type: 'REAL_ESTATE', initialBalance: '0', transactions: [], linkedBankAccounts: [],
            debtProfile: null, realEstateProfile: { recordedValue: '500000' },
          },
          {
            type: 'MORTGAGE', initialBalance: '400000', transactions: [], linkedBankAccounts: [],
            debtProfile: null, realEstateProfile: null,
          },
        ]),
      },
      vehicle: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    await expect(calculateRecordedNetWorth(prisma, 'user-1')).resolves.toEqual(new Decimal('100000'));
  });
});
