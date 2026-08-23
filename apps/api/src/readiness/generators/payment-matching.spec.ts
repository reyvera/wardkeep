import { describe, expect, it } from 'vitest';
import { excludeMatchedCreditCardPayments } from './payment-matching';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('excludeMatchedCreditCardPayments', () => {
  it('excludes a debit paired with an equal credit-card payment within three days', () => {
    const result = excludeMatchedCreditCardPayments(
      [{ id: 'checking-payment', amount: '812.44', date: date('2026-08-20') }],
      [{ id: 'card-credit', amount: '812.44', date: date('2026-08-22') }],
    );

    expect(result).toEqual([]);
  });

  it('keeps a same-amount debit when the matching card credit is too distant', () => {
    const debit = { id: 'groceries', amount: '125.00', date: date('2026-08-01') };
    const result = excludeMatchedCreditCardPayments(
      [debit],
      [{ id: 'card-credit', amount: '125.00', date: date('2026-08-06') }],
    );

    expect(result).toEqual([debit]);
  });

  it('uses each card credit once so duplicate payments are not both excluded', () => {
    const debits = [
      { id: 'payment-one', amount: '500.00', date: date('2026-08-20') },
      { id: 'payment-two', amount: '500.00', date: date('2026-08-20') },
    ];
    const result = excludeMatchedCreditCardPayments(debits, [
      { id: 'card-credit', amount: '500.00', date: date('2026-08-20') },
    ]);

    expect(result).toEqual([debits[1]]);
  });
});
