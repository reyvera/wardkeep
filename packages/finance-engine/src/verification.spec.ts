/**
 * Property-based tests for AI claim verification.
 *
 * Feature: ai-personal-finance-app
 * Property 16
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Decimal } from 'decimal.js';

import {
  verifyAIClaim,
  NumericalClaim,
  FinancialContext,
  ClaimType,
} from './verification';

// ─── Generators ─────────────────────────────────────────────────────────────────

const amountArb = fc
  .double({ min: 0.01, max: 999999.99, noNaN: true, noDefaultInfinity: true })
  .map((n) => n.toFixed(2));

const txTypeArb = fc.constantFrom('CREDIT', 'DEBIT');

const transactionContextArb = fc.record({
  amount: amountArb,
  type: txTypeArb,
  categoryId: fc.option(fc.uuid(), { nil: null }),
  date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
});

const accountContextArb = fc.record({
  id: fc.uuid(),
  initialBalance: amountArb,
  type: fc.constantFrom('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN'),
  isArchived: fc.constant(false),
  transactions: fc.array(transactionContextArb, { minLength: 0, maxLength: 10 }),
});

// ─── Property 16 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 16: Finance Engine verifies and corrects AI numerical claims', () => {
  it('correct claims pass verification', () => {
    fc.assert(
      fc.property(
        accountContextArb,
        (accountCtx) => {
          // Independently compute the correct balance
          const initial = new Decimal(accountCtx.initialBalance);
          const computedBalance = accountCtx.transactions.reduce((bal, tx) => {
            const amount = new Decimal(tx.amount);
            if (tx.type === 'CREDIT') return bal.plus(amount);
            return bal.minus(amount);
          }, initial);

          const context: FinancialContext = {
            accounts: [accountCtx],
          };

          // Claim the correct value
          const claim: NumericalClaim = {
            type: 'account_balance',
            claimedValue: computedBalance.toString(),
            accountId: accountCtx.id,
          };

          const result = verifyAIClaim(claim, context);

          expect(result.isCorrect).toBe(true);
          expect(result.verifiedValue.eq(computedBalance)).toBe(true);
          expect(result.claimedValue.eq(computedBalance)).toBe(true);
          expect(result.correctionWarning).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('wrong claims are detected and corrected', () => {
    fc.assert(
      fc.property(
        accountContextArb,
        amountArb,
        (accountCtx, wrongOffset) => {
          // Independently compute the correct balance
          const initial = new Decimal(accountCtx.initialBalance);
          const computedBalance = accountCtx.transactions.reduce((bal, tx) => {
            const amount = new Decimal(tx.amount);
            if (tx.type === 'CREDIT') return bal.plus(amount);
            return bal.minus(amount);
          }, initial);

          // Add an offset to make the claim wrong
          const wrongValue = computedBalance.plus(new Decimal(wrongOffset));
          fc.pre(!wrongValue.eq(computedBalance));

          const context: FinancialContext = {
            accounts: [accountCtx],
          };

          const claim: NumericalClaim = {
            type: 'account_balance',
            claimedValue: wrongValue.toString(),
            accountId: accountCtx.id,
          };

          const result = verifyAIClaim(claim, context);

          expect(result.isCorrect).toBe(false);
          expect(result.verifiedValue.eq(computedBalance)).toBe(true);
          expect(result.claimedValue.eq(wrongValue)).toBe(true);
          expect(result.correctionWarning).toBeDefined();
          expect(result.correctionWarning).toContain('verified value is');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('net worth claims verified correctly', () => {
    fc.assert(
      fc.property(
        fc.array(accountContextArb, { minLength: 1, maxLength: 5 }),
        (accounts) => {
          // Compute expected net worth
          let assets = new Decimal(0);
          let liabilities = new Decimal(0);
          const ASSET_TYPES = new Set(['CHECKING', 'SAVINGS', 'CASH', 'MANUAL']);
          const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC']);

          for (const acct of accounts) {
            if (acct.isArchived) continue;
            const balance = acct.transactions.reduce((bal, tx) => {
              const amount = new Decimal(tx.amount);
              if (tx.type === 'CREDIT') return bal.plus(amount);
              return bal.minus(amount);
            }, new Decimal(acct.initialBalance));

            if (ASSET_TYPES.has(acct.type)) {
              assets = assets.plus(balance);
            } else if (LIABILITY_TYPES.has(acct.type)) {
              liabilities = liabilities.plus(balance);
            }
          }

          const expectedNetWorth = assets.minus(liabilities);

          const context: FinancialContext = { accounts };

          // Correct claim
          const claim: NumericalClaim = {
            type: 'net_worth',
            claimedValue: expectedNetWorth.toString(),
          };

          const result = verifyAIClaim(claim, context);
          expect(result.isCorrect).toBe(true);
          expect(result.verifiedValue.eq(expectedNetWorth)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
