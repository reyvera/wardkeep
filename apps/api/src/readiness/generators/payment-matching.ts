import { Decimal } from 'decimal.js';

export interface PaymentDebitCandidate {
  id: string;
  amount: Decimal.Value;
  date: Date;
}

export interface CreditCardPaymentCredit {
  id: string;
  amount: Decimal.Value;
  date: Date;
}

const MAXIMUM_MATCH_DAYS = 3;
const MATCH_TOLERANCE = new Decimal('0.01');

/**
 * Removes checking/savings debits that have a matching credit on a household credit-card
 * account. A matched pair is an internal payment, not new household spending. Each credit
 * may match at most one debit so repeated same-amount payments are not over-excluded.
 */
export function excludeMatchedCreditCardPayments<T extends PaymentDebitCandidate>(
  debits: readonly T[],
  cardPaymentCredits: readonly CreditCardPaymentCredit[],
): T[] {
  const availableCredits = [...cardPaymentCredits];

  return debits.filter((debit) => {
    const debitAmount = new Decimal(debit.amount);
    const creditIndex = availableCredits.findIndex((credit) => {
      const amountMatches = debitAmount.sub(credit.amount).abs().lte(MATCH_TOLERANCE);
      const daysApart = Math.abs(debit.date.getTime() - credit.date.getTime()) / 86_400_000;
      return amountMatches && daysApart <= MAXIMUM_MATCH_DAYS;
    });
    if (creditIndex === -1) return true;

    availableCredits.splice(creditIndex, 1);
    return false;
  });
}
