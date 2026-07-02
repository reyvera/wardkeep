/**
 * Account balance calculation using exact decimal arithmetic.
 */
import { Decimal } from 'decimal.js';

import { Transaction, TransactionType } from '@wardkeep/shared';

/**
 * Calculates the current account balance from an initial balance and a list of transactions.
 *
 * Balance = initialBalance + sum(credits) - sum(debits)
 *
 * @param initialBalance - The starting balance of the account as a Decimal.
 * @param transactions - Array of transactions associated with the account.
 * @returns The computed current balance as a Decimal.
 */
export function calculateBalance(initialBalance: Decimal, transactions: Transaction[]): Decimal {
  return transactions.reduce((balance, tx) => {
    const amount = new Decimal(tx.amount);
    if (tx.type === TransactionType.CREDIT) {
      return balance.plus(amount);
    }
    return balance.minus(amount);
  }, initialBalance);
}
