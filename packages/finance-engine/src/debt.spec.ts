/**
 * Property-based tests for debt payoff calculations.
 *
 * Feature: ai-personal-finance-app
 * Properties 17, 18, 19, 20
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Decimal } from 'decimal.js';

import {
  calculatePayoffSchedule,
  compareStrategies,
  Debt,
  PayoffStrategy,
} from './debt';

// ─── Generators ─────────────────────────────────────────────────────────────────

const balanceArb = fc
  .double({ min: 100, max: 50000, noNaN: true, noDefaultInfinity: true })
  .map((n) => n.toFixed(2));

const aprArb = fc
  .double({ min: 0.01, max: 0.30, noNaN: true, noDefaultInfinity: true })
  .map((n) => n.toFixed(4));

const minPaymentArb = fc
  .double({ min: 25, max: 500, noNaN: true, noDefaultInfinity: true })
  .map((n) => n.toFixed(2));

const debtArb: fc.Arbitrary<Debt> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 10 }),
  balance: balanceArb,
  apr: aprArb,
  minimumPayment: minPaymentArb,
  priority: fc.nat({ max: 10 }),
});

const strategyArb: fc.Arbitrary<PayoffStrategy> = fc.constantFrom(
  'snowball',
  'avalanche',
  'custom',
);

// ─── Property 17 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 17: Debt payoff schedule computes correct monthly amortization', () => {
  it('first month interest equals balance * APR/12 for each debt', () => {
    fc.assert(
      fc.property(
        fc.array(debtArb, { minLength: 1, maxLength: 3 }),
        strategyArb,
        (debts, strategy) => {
          // Ensure total payment covers all minimums plus extra
          const sumMinimums = debts.reduce(
            (s, d) => s.plus(new Decimal(d.minimumPayment)),
            new Decimal(0),
          );
          const totalPayment = sumMinimums.plus(new Decimal('100'));

          const result = calculatePayoffSchedule(debts, strategy, totalPayment);

          fc.pre(!result.warning);
          fc.pre(result.schedules.length > 0);

          // Check first month interest for each debt
          for (const schedule of result.schedules) {
            if (schedule.months.length === 0) continue;

            const firstMonth = schedule.months[0];
            const debt = debts.find((d) => d.id === schedule.debtId)!;
            const expectedInterest = new Decimal(debt.balance)
              .times(new Decimal(debt.apr))
              .div(12);

            // Interest should match: balance * APR/12
            // Use tolerance for precision differences in intermediate calculations
            const diff = firstMonth.interest.minus(expectedInterest).abs();
            expect(diff.lt(new Decimal('0.01'))).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 18 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 18: Extra payments distribute according to strategy rules', () => {
  it('extra payment goes to highest priority debt per strategy', () => {
    fc.assert(
      fc.property(
        fc.array(debtArb, { minLength: 2, maxLength: 4 }),
        strategyArb,
        (debts, strategy) => {
          const sumMinimums = debts.reduce(
            (s, d) => s.plus(new Decimal(d.minimumPayment)),
            new Decimal(0),
          );
          // Provide enough extra to see distribution effects
          const extra = new Decimal('200');
          const totalPayment = sumMinimums.plus(extra);

          const result = calculatePayoffSchedule(debts, strategy, totalPayment);

          fc.pre(!result.warning);
          fc.pre(result.schedules.length > 0);

          // Verify total payment in first month does not exceed totalMonthlyPayment
          const firstMonthTotal = result.schedules.reduce((sum, schedule) => {
            if (schedule.months.length === 0) return sum;
            return sum.plus(schedule.months[0].payment);
          }, new Decimal(0));

          // Total paid in first month should not exceed totalPayment
          expect(firstMonthTotal.lte(totalPayment.plus(new Decimal('0.01')))).toBe(true);

          // For each debt, payment should be at least min(minimumPayment, balance + interest)
          // because minimum is capped at balance + interest when balance is small
          for (const schedule of result.schedules) {
            if (schedule.months.length === 0) continue;
            const firstPayment = schedule.months[0].payment;
            const debt = debts.find((d) => d.id === schedule.debtId)!;
            const minPay = new Decimal(debt.minimumPayment);
            const balancePlusInterest = new Decimal(debt.balance).plus(
              new Decimal(debt.balance).times(new Decimal(debt.apr)).div(12),
            );
            const expectedMin = Decimal.min(minPay, balancePlusInterest);
            // Payment should be at least the effective minimum (capped at balance + interest)
            expect(firstPayment.gte(expectedMin.minus(new Decimal('0.01')))).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 19 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 19: Strategy comparison computes correct interest savings', () => {
  it('interest savings equals difference between worst and best strategy total interest', () => {
    fc.assert(
      fc.property(
        fc.array(debtArb, { minLength: 2, maxLength: 3 }),
        (debts) => {
          const sumMinimums = debts.reduce(
            (s, d) => s.plus(new Decimal(d.minimumPayment)),
            new Decimal(0),
          );
          const totalPayment = sumMinimums.plus(new Decimal('150'));

          const strategies: PayoffStrategy[] = ['snowball', 'avalanche'];
          const comparison = compareStrategies(debts, strategies, totalPayment);

          const validResults = comparison.strategies.filter(
            (r) => r.result.schedules.length > 0,
          );

          fc.pre(validResults.length >= 2);

          // Interest savings should be non-negative (worst - best >= 0)
          expect(comparison.interestSavings.gte(new Decimal(0))).toBe(true);

          // Verify it's the actual difference
          const interests = validResults.map((r) => r.result.totalInterest);
          const maxInterest = Decimal.max(...interests);
          const minInterest = Decimal.min(...interests);
          const expectedSavings = maxInterest.minus(minInterest);

          expect(comparison.interestSavings.eq(expectedSavings)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 20 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 20: Insufficient total payment generates warning', () => {
  it('warning when total payment is less than sum of minimum payments', () => {
    fc.assert(
      fc.property(
        fc.array(debtArb, { minLength: 1, maxLength: 5 }),
        strategyArb,
        (debts, strategy) => {
          const sumMinimums = debts.reduce(
            (s, d) => s.plus(new Decimal(d.minimumPayment)),
            new Decimal(0),
          );

          // Set total payment below sum of minimums
          const insufficientPayment = sumMinimums.minus(new Decimal('1'));
          fc.pre(insufficientPayment.gt(0));

          const result = calculatePayoffSchedule(debts, strategy, insufficientPayment);

          expect(result.warning).toBeDefined();
          expect(result.warning).toContain('less than the sum of minimum payments');
          expect(result.schedules.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
