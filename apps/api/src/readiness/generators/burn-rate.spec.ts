import { describe, expect, it } from 'vitest';

import { calculateHouseholdBurnRate } from './burn-rate';

describe('calculateHouseholdBurnRate', () => {
  it('excludes debit records that are clearly internal transfers or card payments', () => {
    const result = calculateHouseholdBurnRate([
      { amount: '300', categoryName: 'Groceries' },
      { amount: '1000', description: 'Credit card payment' },
      { amount: '500', merchant: 'Brokerage transfer' },
    ]);

    expect(result.normalMonthly.toFixed(2)).toBe('100.00');
    expect(result.essentialMonthly.toFixed(2)).toBe('100.00');
    expect(result.excludedTransferLikeCount).toBe(2);
  });

  it('uses categorized essential spending for resilience coverage', () => {
    const result = calculateHouseholdBurnRate([
      { amount: '3000', categoryName: 'Mortgage' },
      { amount: '600', categoryName: 'Groceries' },
      { amount: '900', categoryName: 'Dining out' },
    ]);

    expect(result.normalMonthly.toFixed(2)).toBe('1500.00');
    expect(result.essentialMonthly.toFixed(2)).toBe('1200.00');
    expect(result.usesNormalFallback).toBe(false);
  });

  it('falls back to normal spending when nothing can be classified as essential', () => {
    const result = calculateHouseholdBurnRate([{ amount: '450', merchant: 'Unknown merchant' }]);

    expect(result.essentialMonthly.toFixed(2)).toBe('150.00');
    expect(result.usesNormalFallback).toBe(true);
  });
});
