import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { FinancialContext, NumericalClaim, verifyAIClaim } from './verification';

/**
 * Helper to build a simple financial context.
 */
function buildContext(overrides?: Partial<FinancialContext>): FinancialContext {
  return {
    accounts: [],
    ...overrides,
  };
}

describe('verifyAIClaim', () => {
  describe('account_balance', () => {
    it('returns isCorrect=true when claimed value matches computed balance', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '1000.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '200.00', type: 'DEBIT', categoryId: 'cat-1', date: new Date('2024-01-15') },
              { amount: '50.00', type: 'CREDIT', categoryId: null, date: new Date('2024-01-20') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'account_balance',
        claimedValue: '850.00', // 1000 - 200 + 50
        accountId: 'acc-1',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
      expect(result.verifiedValue.eq(new Decimal('850.00'))).toBe(true);
      expect(result.correctionWarning).toBeUndefined();
    });

    it('returns isCorrect=false with correctionWarning when claim is wrong', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '500.00',
            type: 'SAVINGS',
            isArchived: false,
            transactions: [
              { amount: '100.00', type: 'DEBIT', categoryId: null, date: new Date('2024-02-01') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'account_balance',
        claimedValue: '450.00', // Wrong — correct is 400
        accountId: 'acc-1',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(false);
      expect(result.verifiedValue.eq(new Decimal('400.00'))).toBe(true);
      expect(result.claimedValue.eq(new Decimal('450.00'))).toBe(true);
      expect(result.correctionWarning).toContain('450.00');
      expect(result.correctionWarning).toContain('400.00');
    });

    it('returns zero for unknown account', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '100.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'account_balance',
        claimedValue: '100.00',
        accountId: 'unknown-acc',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(false);
      expect(result.verifiedValue.eq(new Decimal('0'))).toBe(true);
    });
  });

  describe('net_worth', () => {
    it('computes net worth from non-archived accounts (assets - liabilities)', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-checking',
            initialBalance: '5000.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '1000.00', type: 'CREDIT', categoryId: null, date: new Date('2024-01-10') },
            ],
          },
          {
            id: 'acc-cc',
            initialBalance: '0.00',
            type: 'CREDIT_CARD',
            isArchived: false,
            transactions: [
              { amount: '500.00', type: 'DEBIT', categoryId: 'cat-1', date: new Date('2024-01-12') },
            ],
          },
          {
            id: 'acc-archived',
            initialBalance: '9999.00',
            type: 'SAVINGS',
            isArchived: true,
            transactions: [],
          },
        ],
      });

      // Checking: 5000 + 1000 = 6000 (asset)
      // Credit card: 0 - 500 = -500 (liability, balance is -500)
      // Net worth = 6000 - (-500) = 6500
      const claim: NumericalClaim = {
        type: 'net_worth',
        claimedValue: '6500.00',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
      expect(result.verifiedValue.eq(new Decimal('6500.00'))).toBe(true);
    });

    it('excludes archived accounts', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '1000.00',
            type: 'SAVINGS',
            isArchived: true,
            transactions: [],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'net_worth',
        claimedValue: '0.00',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('category_spending', () => {
    it('sums debits for a specific category', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '1000.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '50.00', type: 'DEBIT', categoryId: 'groceries', date: new Date('2024-03-05') },
              { amount: '30.00', type: 'DEBIT', categoryId: 'groceries', date: new Date('2024-03-10') },
              { amount: '100.00', type: 'DEBIT', categoryId: 'rent', date: new Date('2024-03-01') },
              { amount: '200.00', type: 'CREDIT', categoryId: 'groceries', date: new Date('2024-03-15') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'category_spending',
        claimedValue: '80.00', // 50 + 30
        categoryId: 'groceries',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });

    it('filters by month when specified', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '40.00', type: 'DEBIT', categoryId: 'food', date: new Date('2024-01-15') },
              { amount: '60.00', type: 'DEBIT', categoryId: 'food', date: new Date('2024-02-10') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'category_spending',
        claimedValue: '40.00',
        categoryId: 'food',
        month: '2024-01-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('total_spending', () => {
    it('sums all debits across all accounts', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '100.00', type: 'DEBIT', categoryId: 'cat-1', date: new Date('2024-04-01') },
              { amount: '200.00', type: 'CREDIT', categoryId: null, date: new Date('2024-04-02') },
            ],
          },
          {
            id: 'acc-2',
            initialBalance: '0.00',
            type: 'SAVINGS',
            isArchived: false,
            transactions: [
              { amount: '75.50', type: 'DEBIT', categoryId: 'cat-2', date: new Date('2024-04-05') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'total_spending',
        claimedValue: '175.50', // 100 + 75.50
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });

    it('filters total spending by month', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '50.00', type: 'DEBIT', categoryId: null, date: new Date('2024-05-10') },
              { amount: '25.00', type: 'DEBIT', categoryId: null, date: new Date('2024-06-10') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'total_spending',
        claimedValue: '50.00',
        month: '2024-05-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('budget_remaining', () => {
    it('computes allocated minus spent for a category in a month', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '120.00', type: 'DEBIT', categoryId: 'groceries', date: new Date('2024-03-15') },
              { amount: '30.00', type: 'DEBIT', categoryId: 'groceries', date: new Date('2024-03-20') },
            ],
          },
        ],
        budgetAllocations: [
          { categoryId: 'groceries', amount: '500.00', month: '2024-03-01' },
        ],
      });

      // Remaining = 500 - (120 + 30) = 350
      const claim: NumericalClaim = {
        type: 'budget_remaining',
        claimedValue: '350.00',
        categoryId: 'groceries',
        month: '2024-03-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
      expect(result.verifiedValue.eq(new Decimal('350.00'))).toBe(true);
    });

    it('returns zero remaining when no allocation exists', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '50.00', type: 'DEBIT', categoryId: 'dining', date: new Date('2024-03-10') },
            ],
          },
        ],
        budgetAllocations: [],
      });

      // No allocation → allocated = 0, spent = 50, remaining = -50
      const claim: NumericalClaim = {
        type: 'budget_remaining',
        claimedValue: '-50.00',
        categoryId: 'dining',
        month: '2024-03-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('monthly_income', () => {
    it('sums all credits in the specified month', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '3000.00', type: 'CREDIT', categoryId: null, date: new Date('2024-06-01') },
              { amount: '500.00', type: 'CREDIT', categoryId: null, date: new Date('2024-06-15') },
              { amount: '1000.00', type: 'DEBIT', categoryId: 'rent', date: new Date('2024-06-01') },
              { amount: '2000.00', type: 'CREDIT', categoryId: null, date: new Date('2024-07-01') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'monthly_income',
        claimedValue: '3500.00', // 3000 + 500
        month: '2024-06-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });

    it('returns zero when no credits in the month', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '0.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [
              { amount: '100.00', type: 'DEBIT', categoryId: null, date: new Date('2024-08-10') },
            ],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'monthly_income',
        claimedValue: '0.00',
        month: '2024-08-01',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('correction warning format', () => {
    it('includes both claimed and verified values in the warning message', () => {
      const context = buildContext({
        accounts: [
          {
            id: 'acc-1',
            initialBalance: '1000.00',
            type: 'CHECKING',
            isArchived: false,
            transactions: [],
          },
        ],
      });

      const claim: NumericalClaim = {
        type: 'account_balance',
        claimedValue: '999.00',
        accountId: 'acc-1',
      };

      const result = verifyAIClaim(claim, context);
      expect(result.isCorrect).toBe(false);
      expect(result.correctionWarning).toBeDefined();
      expect(result.correctionWarning).toContain('999.00');
      expect(result.correctionWarning).toContain('1000.00');
      expect(result.correctionWarning).toContain('Displaying corrected value');
    });
  });
});
