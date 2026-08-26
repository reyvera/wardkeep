import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { HouseholdBurnRate } from './burn-rate';
import {
  emergencyFundSignal,
  estateDocumentReviewSignal,
  fixedObligationSignal,
  insuranceCoverageTargetSignal,
  insuranceRenewalSignal,
  monthlyRecurringAmount,
} from './protection.generator';

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

describe('insuranceCoverageTargetSignal', () => {
  it('flags only a recorded amount below the household-entered target', () => {
    const signal = insuranceCoverageTargetSignal({
      type: 'LIFE',
      provider: 'Example',
      coverageAmount: new Decimal(300_000),
      coverageTargetAmount: new Decimal(500_000),
    });

    expect(signal).toMatchObject({ capabilityId: 'insurance-coverage-target', type: 'warning' });
    expect(signal?.summary).toContain('$500000.00 coverage target');
    expect(signal?.summary).toContain('does not determine');
  });

  it('does not infer a target or adequacy from missing or sufficient records', () => {
    expect(
      insuranceCoverageTargetSignal({
        type: 'LIFE',
        provider: 'Example',
        coverageAmount: new Decimal(500_000),
        coverageTargetAmount: null,
      }),
    ).toBeNull();
    expect(
      insuranceCoverageTargetSignal({
        type: 'LIFE',
        provider: 'Example',
        coverageAmount: new Decimal(500_000),
        coverageTargetAmount: new Decimal(500_000),
      }),
    ).toBeNull();
  });
});

describe('estateDocumentReviewSignal', () => {
  it('reminds the household about an upcoming recorded review without assessing the document', () => {
    const signal = estateDocumentReviewSignal(
      { type: 'WILL', title: 'Family will', reviewDate: new Date('2026-09-05T00:00:00.000Z') },
      now,
    );
    expect(signal).toMatchObject({ type: 'warning', magnitude: -2, capabilityId: 'estate-documents' });
    expect(signal?.summary).toContain('14 days');
  });

  it('does not infer a concern where no review date is entered', () => {
    expect(estateDocumentReviewSignal({ type: 'TRUST', title: null, reviewDate: null }, now)).toBeNull();
  });
});

describe('fixedObligationSignal', () => {
  it('includes confirmed recurring bills with recorded debt minimums', () => {
    const signal = fixedObligationSignal({
      monthlyDebtMinimums: new Decimal(400),
      monthlyRecurringBills: new Decimal(700),
      monthlyManualObligations: new Decimal(0),
      variableManualObligationCount: 0,
      reserves: new Decimal(1_000),
    });

    expect(signal).toHaveLength(1);
    expect(signal[0]).toMatchObject({ capabilityId: 'fixed-obligations', type: 'warning' });
    expect(signal[0]?.summary).toContain('$700.00 in confirmed recurring bills');
    expect(signal[0]?.summary).toContain('unrecorded commitments are not included');
  });

  it('does not infer risk when known commitments are within reserves', () => {
    expect(
      fixedObligationSignal({
        monthlyDebtMinimums: new Decimal(400),
        monthlyRecurringBills: new Decimal(700),
        monthlyManualObligations: new Decimal(0),
        variableManualObligationCount: 0,
        reserves: new Decimal(1_100),
      }),
    ).toEqual([]);
  });

  it('normalizes confirmed recurring amounts by their recorded frequency', () => {
    expect(monthlyRecurringAmount(new Decimal(120), 'ANNUAL').toFixed(2)).toBe('10.00');
    expect(monthlyRecurringAmount(new Decimal(100), 'BIWEEKLY').toFixed(2)).toBe('216.67');
  });

  it('includes entered variable obligations as labeled household estimates', () => {
    const signal = fixedObligationSignal({
      monthlyDebtMinimums: new Decimal(0),
      monthlyRecurringBills: new Decimal(0),
      monthlyManualObligations: new Decimal(1_100),
      variableManualObligationCount: 1,
      reserves: new Decimal(1_000),
    });

    expect(signal[0]?.summary).toContain('$1100.00 in entered external commitments (1 marked variable)');
    expect(signal[0]?.summary).toContain('household estimates');
  });
});

function burnRate(monthlyExpenses: number, usesNormalFallback = false): HouseholdBurnRate {
  return {
    normalMonthly: new Decimal(monthlyExpenses),
    essentialMonthly: new Decimal(monthlyExpenses),
    usesNormalFallback,
    excludedTransferLikeCount: 0,
    excludedOneTimeCount: 0,
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
