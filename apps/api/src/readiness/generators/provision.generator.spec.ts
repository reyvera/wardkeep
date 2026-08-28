import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { budgetPaceSignals, cashFlowProjectionSignal } from './provision.generator';

describe('finance provision thresholds', () => {
  it('flags recorded spending at 95% of the monthly budget as a bounded risk', () => {
    const signals = budgetPaceSignals(
      new Decimal(1_000),
      new Decimal(950),
      0,
      new Date('2026-08-10T12:00:00.000Z'),
    );

    expect(signals).toContainEqual(expect.objectContaining({
      capabilityId: 'budgets', type: 'risk', magnitude: -5,
    }));
  });

  it('flags a cash-flow projection that goes negative within 14 days', () => {
    // The 14-day occurrence is a subset of the published 30-day projection window.
    const signal = cashFlowProjectionSignal(1);

    expect(signal).toMatchObject({ capabilityId: 'cashflow', type: 'risk', magnitude: -8 });
    expect(signal.magnitude).toBeGreaterThanOrEqual(-10);
    expect(signal.magnitude).toBeLessThanOrEqual(10);
  });
});
