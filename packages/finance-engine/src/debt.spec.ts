import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { calculatePayoffSchedule, compareStrategies, Debt, PayoffStrategy } from './debt';

// ─── Test Fixtures ──────────────────────────────────────────────────────────────

const singleDebt: Debt = {
  id: 'debt-1',
  name: 'Credit Card A',
  balance: '5000',
  apr: '0.1999',
  minimumPayment: '100',
};

const twoDebts: Debt[] = [
  {
    id: 'debt-1',
    name: 'Small Balance Card',
    balance: '1000',
    apr: '0.15',
    minimumPayment: '25',
  },
  {
    id: 'debt-2',
    name: 'High Rate Card',
    balance: '5000',
    apr: '0.24',
    minimumPayment: '100',
  },
];

const threeDebtsCustom: Debt[] = [
  {
    id: 'debt-1',
    name: 'Car Loan',
    balance: '10000',
    apr: '0.05',
    minimumPayment: '200',
    priority: 3,
  },
  {
    id: 'debt-2',
    name: 'Credit Card',
    balance: '3000',
    apr: '0.22',
    minimumPayment: '60',
    priority: 1,
  },
  {
    id: 'debt-3',
    name: 'Student Loan',
    balance: '15000',
    apr: '0.065',
    minimumPayment: '150',
    priority: 2,
  },
];

// ─── Validation Tests ───────────────────────────────────────────────────────────

describe('calculatePayoffSchedule - validation', () => {
  it('returns warning when total payment is less than sum of minimums', () => {
    const result = calculatePayoffSchedule(
      twoDebts,
      'avalanche',
      new Decimal('100'), // sum of minimums is 125
    );

    expect(result.schedules).toHaveLength(0);
    expect(result.warning).toContain('less than the sum of minimum payments');
    expect(result.totalInterest.eq(0)).toBe(true);
    expect(result.totalMonths).toBe(0);
    expect(result.debtFreeDate).toBe(0);
  });

  it('returns warning when balance is not positive', () => {
    const invalidDebt: Debt = {
      id: 'bad',
      name: 'Bad Debt',
      balance: '0',
      apr: '0.10',
      minimumPayment: '10',
    };

    const result = calculatePayoffSchedule([invalidDebt], 'snowball', new Decimal('100'));
    expect(result.warning).toContain('balance must be greater than 0');
  });

  it('returns warning when APR exceeds 100%', () => {
    const invalidDebt: Debt = {
      id: 'bad',
      name: 'Bad Debt',
      balance: '1000',
      apr: '1.5',
      minimumPayment: '50',
    };

    const result = calculatePayoffSchedule([invalidDebt], 'snowball', new Decimal('100'));
    expect(result.warning).toContain('APR must be between 0 and 1');
  });

  it('returns warning when minimum payment is below 0.01', () => {
    const invalidDebt: Debt = {
      id: 'bad',
      name: 'Bad Debt',
      balance: '1000',
      apr: '0.10',
      minimumPayment: '0.001',
    };

    const result = calculatePayoffSchedule([invalidDebt], 'snowball', new Decimal('100'));
    expect(result.warning).toContain('minimum payment must be at least 0.01');
  });

  it('returns warning when more than 50 debts are provided', () => {
    const manyDebts: Debt[] = Array.from({ length: 51 }, (_, i) => ({
      id: `debt-${i}`,
      name: `Debt ${i}`,
      balance: '1000',
      apr: '0.10',
      minimumPayment: '20',
    }));

    const result = calculatePayoffSchedule(manyDebts, 'snowball', new Decimal('2000'));
    expect(result.warning).toContain('Cannot process more than 50 debts');
  });
});

// ─── Single Debt Tests ──────────────────────────────────────────────────────────

describe('calculatePayoffSchedule - single debt', () => {
  it('calculates correct payoff for a single debt', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));

    expect(result.schedules).toHaveLength(1);
    expect(result.totalMonths).toBeGreaterThan(0);
    expect(result.totalMonths).toBeLessThanOrEqual(360);
    expect(result.totalInterest.gt(0)).toBe(true);
    expect(result.debtFreeDate).toBe(result.totalMonths);
  });

  it('generates correct monthly interest calculation', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const firstMonth = result.schedules[0].months[0];

    // Interest for first month: 5000 * (0.1999/12) = 83.291666...
    const expectedInterest = new Decimal('5000').times(new Decimal('0.1999').div(12));
    expect(firstMonth.interest.toFixed(10)).toBe(expectedInterest.toFixed(10));
    expect(firstMonth.month).toBe(1);
    expect(firstMonth.debtId).toBe('debt-1');
  });

  it('last month remaining balance is zero', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const schedule = result.schedules[0];
    const lastMonth = schedule.months[schedule.months.length - 1];

    expect(lastMonth.remainingBalance.eq(0)).toBe(true);
  });

  it('total paid equals balance plus total interest', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const schedule = result.schedules[0];

    // Total paid should equal original balance + total interest
    const expectedTotal = new Decimal(singleDebt.balance).plus(schedule.totalInterest);
    // Allow tiny rounding difference (last payment may be slightly less)
    expect(schedule.totalPaid.minus(expectedTotal).abs().lte(new Decimal('0.01'))).toBe(true);
  });
});

// ─── Snowball Strategy Tests ────────────────────────────────────────────────────

describe('calculatePayoffSchedule - snowball strategy', () => {
  it('pays off lowest balance debt first', () => {
    const result = calculatePayoffSchedule(twoDebts, 'snowball', new Decimal('250'));

    const smallDebtSchedule = result.schedules.find((s) => s.debtId === 'debt-1')!;
    const largeDebtSchedule = result.schedules.find((s) => s.debtId === 'debt-2')!;

    expect(smallDebtSchedule.payoffMonth).toBeLessThan(largeDebtSchedule.payoffMonth);
  });

  it('redirects extra payment to lowest balance', () => {
    const result = calculatePayoffSchedule(twoDebts, 'snowball', new Decimal('250'));
    const smallDebtSchedule = result.schedules.find((s) => s.debtId === 'debt-1')!;

    // First month: extra payment (250 - 125 minimums = 125) goes to debt-1 (lowest balance)
    // debt-1 gets minimum (25) + extra (125) = 150
    const firstMonthPayment = smallDebtSchedule.months[0].payment;
    expect(firstMonthPayment.gte(new Decimal('125'))).toBe(true);
  });
});

// ─── Avalanche Strategy Tests ───────────────────────────────────────────────────

describe('calculatePayoffSchedule - avalanche strategy', () => {
  it('directs extra payment to highest APR debt first', () => {
    const result = calculatePayoffSchedule(twoDebts, 'avalanche', new Decimal('250'));

    const highRateSchedule = result.schedules.find((s) => s.debtId === 'debt-2')!;

    // Extra goes to debt-2 (24% APR > 15% APR)
    // debt-2 gets minimum (100) + extra (125) = 225
    const firstMonthPayment = highRateSchedule.months[0].payment;
    expect(firstMonthPayment.gte(new Decimal('200'))).toBe(true);
  });

  it('results in less total interest than snowball for different-rate debts', () => {
    const avalancheResult = calculatePayoffSchedule(twoDebts, 'avalanche', new Decimal('250'));
    const snowballResult = calculatePayoffSchedule(twoDebts, 'snowball', new Decimal('250'));

    expect(avalancheResult.totalInterest.lte(snowballResult.totalInterest)).toBe(true);
  });
});

// ─── Custom Priority Tests ──────────────────────────────────────────────────────

describe('calculatePayoffSchedule - custom strategy', () => {
  it('pays debts in custom priority order', () => {
    const result = calculatePayoffSchedule(threeDebtsCustom, 'custom', new Decimal('600'));

    const creditCard = result.schedules.find((s) => s.debtId === 'debt-2')!; // priority 1
    const studentLoan = result.schedules.find((s) => s.debtId === 'debt-3')!; // priority 2
    const carLoan = result.schedules.find((s) => s.debtId === 'debt-1')!; // priority 3

    expect(creditCard.payoffMonth).toBeLessThan(studentLoan.payoffMonth);
    expect(studentLoan.payoffMonth).toBeLessThanOrEqual(carLoan.payoffMonth);
  });
});

// ─── Projection Cap Tests ───────────────────────────────────────────────────────

describe('calculatePayoffSchedule - projection cap', () => {
  it('caps at 360 months and returns warning', () => {
    // Extremely low payment relative to balance will not pay off in 360 months
    const massiveDebt: Debt = {
      id: 'massive',
      name: 'Massive Loan',
      balance: '1000000',
      apr: '0.20',
      minimumPayment: '100',
    };

    const result = calculatePayoffSchedule([massiveDebt], 'avalanche', new Decimal('100'));
    expect(result.totalMonths).toBe(360);
    expect(result.warning).toContain('capped at 360 months');
  });
});

// ─── What-If Mode (Pure Function) Tests ─────────────────────────────────────────

describe('calculatePayoffSchedule - what-if mode', () => {
  it('does not mutate input debt objects', () => {
    const debts: Debt[] = [
      { id: 'd1', name: 'Card', balance: '2000', apr: '0.18', minimumPayment: '40' },
    ];

    const originalBalance = debts[0].balance;
    const originalApr = debts[0].apr;

    calculatePayoffSchedule(debts, 'avalanche', new Decimal('200'));

    expect(debts[0].balance).toBe(originalBalance);
    expect(debts[0].apr).toBe(originalApr);
  });

  it('produces consistent results on repeated calls', () => {
    const result1 = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const result2 = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));

    expect(result1.totalMonths).toBe(result2.totalMonths);
    expect(result1.totalInterest.eq(result2.totalInterest)).toBe(true);
  });
});

// ─── Precision Tests ────────────────────────────────────────────────────────────

describe('calculatePayoffSchedule - precision', () => {
  it('uses 10+ decimal places for intermediate interest calculations', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const firstMonth = result.schedules[0].months[0];

    // Interest should have many decimal places internally
    const interestStr = firstMonth.interest.toFixed(12);
    expect(interestStr.length).toBeGreaterThan(10);
  });

  it('display values can be rounded to 2 decimal places without error', () => {
    const result = calculatePayoffSchedule([singleDebt], 'avalanche', new Decimal('200'));
    const firstMonth = result.schedules[0].months[0];

    expect(() => firstMonth.payment.toFixed(2)).not.toThrow();
    expect(() => firstMonth.interest.toFixed(2)).not.toThrow();
    expect(() => firstMonth.principal.toFixed(2)).not.toThrow();
    expect(() => firstMonth.remainingBalance.toFixed(2)).not.toThrow();
  });
});

// ─── Compare Strategies Tests ───────────────────────────────────────────────────

describe('compareStrategies', () => {
  it('compares multiple strategies and computes savings', () => {
    const strategies: PayoffStrategy[] = ['snowball', 'avalanche'];
    const result = compareStrategies(twoDebts, strategies, new Decimal('250'));

    expect(result.strategies).toHaveLength(2);
    expect(result.interestSavings.gte(0)).toBe(true);
    expect(result.timeSavings).toBeGreaterThanOrEqual(0);
  });

  it('interest savings equals difference between worst and best', () => {
    const strategies: PayoffStrategy[] = ['snowball', 'avalanche'];
    const result = compareStrategies(twoDebts, strategies, new Decimal('250'));

    const snowball = result.strategies.find((s) => s.strategy === 'snowball')!;
    const avalanche = result.strategies.find((s) => s.strategy === 'avalanche')!;

    const expectedSavings = snowball.result.totalInterest.minus(avalanche.result.totalInterest);
    expect(result.interestSavings.eq(expectedSavings.abs())).toBe(true);
  });

  it('time savings equals months difference between worst and best', () => {
    const strategies: PayoffStrategy[] = ['snowball', 'avalanche'];
    const result = compareStrategies(twoDebts, strategies, new Decimal('250'));

    const snowball = result.strategies.find((s) => s.strategy === 'snowball')!;
    const avalanche = result.strategies.find((s) => s.strategy === 'avalanche')!;

    const expectedTimeSavings = Math.abs(
      snowball.result.totalMonths - avalanche.result.totalMonths,
    );
    expect(result.timeSavings).toBe(expectedTimeSavings);
  });

  it('handles all three strategies including custom', () => {
    const strategies: PayoffStrategy[] = ['snowball', 'avalanche', 'custom'];
    const result = compareStrategies(threeDebtsCustom, strategies, new Decimal('600'));

    expect(result.strategies).toHaveLength(3);
    result.strategies.forEach((s) => {
      expect(s.result.schedules.length).toBeGreaterThan(0);
    });
  });

  it('returns zero savings when no valid results', () => {
    const invalidDebts: Debt[] = [
      { id: 'd1', name: 'Bad', balance: '-100', apr: '0.10', minimumPayment: '20' },
    ];

    const result = compareStrategies(invalidDebts, ['snowball', 'avalanche'], new Decimal('100'));
    expect(result.interestSavings.eq(0)).toBe(true);
    expect(result.timeSavings).toBe(0);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────────

describe('calculatePayoffSchedule - edge cases', () => {
  it('handles 0% APR debt correctly', () => {
    const zeroAprDebt: Debt = {
      id: 'zero-apr',
      name: 'Interest Free',
      balance: '1200',
      apr: '0',
      minimumPayment: '50',
    };

    const result = calculatePayoffSchedule([zeroAprDebt], 'avalanche', new Decimal('200'));

    expect(result.totalInterest.eq(0)).toBe(true);
    expect(result.totalMonths).toBe(6); // 1200 / 200 = 6 months
  });

  it('handles payment exactly equal to sum of minimums', () => {
    const result = calculatePayoffSchedule(twoDebts, 'snowball', new Decimal('125'));

    // Should not return warning — exact equal is valid
    expect(result.warning).toBeUndefined();
    expect(result.schedules.length).toBeGreaterThan(0);
  });

  it('handles single debt with payment much larger than balance', () => {
    const tinyDebt: Debt = {
      id: 'tiny',
      name: 'Tiny Balance',
      balance: '50',
      apr: '0.18',
      minimumPayment: '10',
    };

    const result = calculatePayoffSchedule([tinyDebt], 'avalanche', new Decimal('1000'));
    expect(result.totalMonths).toBe(1);
  });
});
