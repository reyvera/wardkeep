import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { HouseholdBurnRate } from './burn-rate';
import { emergencyFundSignal, insuranceRenewalSignal } from './protection.generator';

const now = new Date('2026-08-22T12:00:00.000Z');

describe('insuranceRenewalSignal', () => {
  it('warns when an entered policy renews within 30 days', () => {
    const signal = insuranceRenewalSignal(
      { type: 'AUTO', provider: 'State Farm', renewalDate: new Date('2026-09-05T00:00:00.000Z') },
      now,
    );
    expect(signal).toMatchObject({ type: 'warning', magnitude: -3, capabilityId: 'insurance' });
    expect(signal?.summary).toContain('14 days');
  });

  it('flags a recorded renewal date that has passed', () => {
    const signal = insuranceRenewalSignal(
      { type: 'HOME', provider: 'Travelers', renewalDate: new Date('2026-08-20T00:00:00.000Z') },
      now,
    );
    expect(signal).toMatchObject({ type: 'risk', magnitude: -6 });
  });

  it('does not infer a renewal concern when no date is recorded or it is distant', () => {
    expect(
      insuranceRenewalSignal({ type: 'LIFE', provider: 'Example', renewalDate: null }, now),
    ).toBeNull();
    expect(
      insuranceRenewalSignal(
        { type: 'LIFE', provider: 'Example', renewalDate: new Date('2026-10-01T00:00:00.000Z') },
        now,
      ),
    ).toBeNull();
  });
});

function burnRate(monthlyExpenses: number, usesNormalFallback = false): HouseholdBurnRate {
  return {
    normalMonthly: new Decimal(monthlyExpenses),
    essentialMonthly: new Decimal(monthlyExpenses),
    usesNormalFallback,
    excludedTransferLikeCount: 0,
  };
}

describe('emergencyFundSignal', () => {
  it.each([
    [0, 'risk', '0.0 months'],
    [0.5, 'risk', '0.5 months'],
    [1, 'risk', '1.0 months'],
    [3, 'risk', '3.0 months'],
    [6, 'warning', '6.0 months'],
    [12, 'positive', '12.0 months'],
    [18, 'positive', '18.0 months'],
  ])(
    'covers the %s-month liquidity band without flattening the result',
    (months, type, summary) => {
      const signal = emergencyFundSignal(new Decimal(months * 1_000), burnRate(1_000))[0]!;

      expect(signal).toMatchObject({ capabilityId: 'emergency-fund', type });
      expect(signal.summary).toContain(summary);
    },
  );

  it('does not claim coverage when ordinary expense history is absent', () => {
    const signal = emergencyFundSignal(new Decimal(5_000), burnRate(0))[0]!;

    expect(signal).toMatchObject({ type: 'warning', magnitude: -5 });
    expect(signal.summary).toContain('cannot calculate coverage');
  });

  it('distinguishes a 3-month reserve from a 12-month reserve', () => {
    const threeMonths = emergencyFundSignal(new Decimal(3_000), burnRate(1_000))[0]!;
    const twelveMonths = emergencyFundSignal(new Decimal(12_000), burnRate(1_000))[0]!;

    expect(threeMonths.magnitude).toBeLessThan(twelveMonths.magnitude);
    expect(twelveMonths.summary).toContain('maximum readiness benchmark');
  });

  it('discloses when ordinary spending is used because essential expenses are uncategorized', () => {
    const signal = emergencyFundSignal(new Decimal(3_000), burnRate(1_000, true))[0]!;

    expect(signal.summary).toContain('essential expenses are not categorized yet');
  });
});
