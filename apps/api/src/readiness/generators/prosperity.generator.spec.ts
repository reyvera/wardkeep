import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { netWorthTrendSignal } from './prosperity.generator';

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
