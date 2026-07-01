import { describe, it, expect, vi } from 'vitest';

import { AICategorizer, CategoryRef, CategorizationInput } from './categorizer';
import { AIProvider } from './providers/ai-provider';

/** Create a mock AI provider. */
function createMockProvider(response: string): AIProvider {
  return {
    name: 'mock',
    complete: vi.fn().mockResolvedValue(response),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

const categories: CategoryRef[] = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Transportation' },
  { id: 'cat-3', name: 'Entertainment' },
  { id: 'cat-4', name: 'Dining' },
];

describe('AICategorizer', () => {
  describe('categorize', () => {
    it('should return correction with confidence 1.0 when merchant has been corrected', async () => {
      const provider = createMockProvider('should not be called');
      const categorizer = new AICategorizer(provider);

      const corrections = new Map<string, string>();
      corrections.set('walmart', 'cat-1');

      const transaction: CategorizationInput = {
        merchant: 'Walmart',
        amount: '45.99',
        description: 'Weekly shopping',
      };

      const result = await categorizer.categorize(transaction, categories, corrections);

      expect(result.categoryId).toBe('cat-1');
      expect(result.categoryName).toBe('Groceries');
      expect(result.confidence).toBe(1.0);
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('should call provider when no correction exists', async () => {
      const response = '{ "category": "Transportation", "confidence": 0.92 }';
      const provider = createMockProvider(response);
      const categorizer = new AICategorizer(provider);

      const transaction: CategorizationInput = {
        merchant: 'Uber',
        amount: '24.50',
        description: 'Ride to airport',
      };

      const result = await categorizer.categorize(
        transaction,
        categories,
        new Map<string, string>(),
      );

      expect(result.categoryId).toBe('cat-2');
      expect(result.categoryName).toBe('Transportation');
      expect(result.confidence).toBe(0.92);
      expect(provider.complete).toHaveBeenCalledOnce();
    });

    it('should return Uncategorized when provider returns invalid JSON', async () => {
      const provider = createMockProvider('I cannot categorize this transaction.');
      const categorizer = new AICategorizer(provider);

      const transaction: CategorizationInput = {
        merchant: 'Random Store',
        amount: '10.00',
        description: null,
      };

      const result = await categorizer.categorize(
        transaction,
        categories,
        new Map<string, string>(),
      );

      expect(result.categoryName).toBe('Uncategorized');
      expect(result.confidence).toBe(0.0);
    });

    it('should return Uncategorized when provider throws', async () => {
      const provider: AIProvider = {
        name: 'mock',
        complete: vi.fn().mockRejectedValue(new Error('Network error')),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const categorizer = new AICategorizer(provider);

      const transaction: CategorizationInput = {
        merchant: 'Store',
        amount: '5.00',
        description: null,
      };

      const result = await categorizer.categorize(
        transaction,
        categories,
        new Map<string, string>(),
      );

      expect(result.categoryName).toBe('Uncategorized');
      expect(result.confidence).toBe(0.0);
    });

    it('should return Uncategorized when category name does not match', async () => {
      const response = '{ "category": "NonExistent", "confidence": 0.95 }';
      const provider = createMockProvider(response);
      const categorizer = new AICategorizer(provider);

      const transaction: CategorizationInput = {
        merchant: 'Mystery Shop',
        amount: '20.00',
        description: null,
      };

      const result = await categorizer.categorize(
        transaction,
        categories,
        new Map<string, string>(),
      );

      expect(result.categoryName).toBe('Uncategorized');
      expect(result.confidence).toBe(0.0);
    });

    it('should clamp confidence to 0-1 range', async () => {
      const response = '{ "category": "Groceries", "confidence": 1.5 }';
      const provider = createMockProvider(response);
      const categorizer = new AICategorizer(provider);

      const transaction: CategorizationInput = {
        merchant: 'Supermarket',
        amount: '30.00',
        description: null,
      };

      const result = await categorizer.categorize(
        transaction,
        categories,
        new Map<string, string>(),
      );

      expect(result.confidence).toBe(1.0);
    });
  });

  describe('batchCategorize', () => {
    it('should categorize multiple transactions', async () => {
      const provider: AIProvider = {
        name: 'mock',
        complete: vi
          .fn()
          .mockResolvedValueOnce('{ "category": "Groceries", "confidence": 0.88 }')
          .mockResolvedValueOnce('{ "category": "Dining", "confidence": 0.75 }'),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const categorizer = new AICategorizer(provider);

      const transactions: CategorizationInput[] = [
        { merchant: 'Trader Joes', amount: '55.00', description: null },
        { merchant: 'Chipotle', amount: '12.50', description: 'Lunch' },
      ];

      const results = await categorizer.batchCategorize(
        transactions,
        categories,
        new Map<string, string>(),
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.categoryName).toBe('Groceries');
      expect(results[1]?.categoryName).toBe('Dining');
    });
  });
});
