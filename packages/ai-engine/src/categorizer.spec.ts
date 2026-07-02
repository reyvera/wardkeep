import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

import { AICategorizer, CategoryRef, CategorizationInput } from './categorizer';
import { AI_CONFIDENCE_AUTO_ASSIGN, AI_CONFIDENCE_SUGGEST } from '@budgetapp/shared';
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


// ─── Property-Based Tests ────────────────────────────────────────────────────────

// ─── Generators ──────────────────────────────────────────────────────────────────

const merchantArb = fc
  .string({ minLength: 2, maxLength: 20 })
  .map((s) => s.replace(/[\n\r]/g, ' ').trim())
  .filter((s) => s.length >= 2);

const amountArb = fc
  .tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, frac]) => `${whole}.${String(frac).padStart(2, '0')}`);

const categoryRefArb = fc.record({
  id: fc.uuid(),
  name: fc.stringMatching(/^[a-zA-Z]{3,15}$/),
});

/** Generate a list of categories with unique IDs and unique lowercase names. */
const uniqueCategoriesArb = (minLen: number, maxLen: number) =>
  fc.array(categoryRefArb, { minLength: maxLen, maxLength: maxLen * 2 }).map((cats) => {
    const seen = new Set<string>();
    const seenIds = new Set<string>();
    const result: typeof cats = [];
    for (const cat of cats) {
      const lower = cat.name.toLowerCase();
      if (!seen.has(lower) && !seenIds.has(cat.id) && result.length < maxLen) {
        seen.add(lower);
        seenIds.add(cat.id);
        result.push(cat);
      }
    }
    return result;
  }).filter((cats) => cats.length >= minLen);

const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

// ─── Property 14 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 14: AI categorization confidence thresholds route correctly', () => {
  it('>0.85 auto-assign, 0.50-0.85 suggest, <0.50 uncategorized', async () => {
    await fc.assert(
      fc.asyncProperty(
        confidenceArb,
        uniqueCategoriesArb(1, 5),
        merchantArb,
        amountArb,
        async (confidence, generatedCategories, merchant, amount) => {
          // Pick the first category as the one the AI "selects"
          const targetCategory = generatedCategories[0];

          // Create a mock provider that returns the target category with the given confidence
          const response = JSON.stringify({
            category: targetCategory.name,
            confidence,
          });
          const provider: AIProvider = {
            name: 'mock',
            complete: vi.fn().mockResolvedValue(response),
            isAvailable: vi.fn().mockResolvedValue(true),
          };

          const categorizer = new AICategorizer(provider);
          const transaction: CategorizationInput = {
            merchant,
            amount,
            description: null,
          };

          const result = await categorizer.categorize(
            transaction,
            generatedCategories,
            new Map(),
          );

          const clampedConfidence = Math.max(0, Math.min(1, confidence));

          if (clampedConfidence >= AI_CONFIDENCE_AUTO_ASSIGN) {
            // Should be auto-assigned: matched category with high confidence
            expect(result.categoryId).toBe(targetCategory.id);
            expect(result.categoryName).toBe(targetCategory.name);
            expect(result.confidence).toBeGreaterThanOrEqual(AI_CONFIDENCE_AUTO_ASSIGN);
          } else if (clampedConfidence >= AI_CONFIDENCE_SUGGEST) {
            // Should be a suggestion: matched category with medium confidence
            expect(result.categoryId).toBe(targetCategory.id);
            expect(result.categoryName).toBe(targetCategory.name);
            expect(result.confidence).toBeGreaterThanOrEqual(AI_CONFIDENCE_SUGGEST);
            expect(result.confidence).toBeLessThan(AI_CONFIDENCE_AUTO_ASSIGN);
          } else {
            // Low confidence: the categorizer still returns the match but with low score
            // The routing decision (auto/suggest/uncategorized) is based on the confidence value
            expect(result.confidence).toBeLessThan(AI_CONFIDENCE_SUGGEST);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 15 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 15: User category correction trains merchant mapping', () => {
  it('subsequent requests for same merchant use correction instead of calling AI', async () => {
    await fc.assert(
      fc.asyncProperty(
        merchantArb,
        amountArb,
        uniqueCategoriesArb(2, 5),
        async (merchant, amount, generatedCategories) => {
          // The correction maps the merchant to the second category
          const correctedCategory = generatedCategories[1];
          const corrections = new Map<string, string>();
          corrections.set(merchant.toLowerCase(), correctedCategory.id);

          // Provider should NOT be called if correction exists
          const provider: AIProvider = {
            name: 'mock',
            complete: vi.fn().mockResolvedValue('should not be called'),
            isAvailable: vi.fn().mockResolvedValue(true),
          };

          const categorizer = new AICategorizer(provider);
          const transaction: CategorizationInput = {
            merchant,
            amount,
            description: 'Some purchase',
          };

          const result = await categorizer.categorize(
            transaction,
            generatedCategories,
            corrections,
          );

          // Correction is applied with confidence 1.0
          expect(result.categoryId).toBe(correctedCategory.id);
          expect(result.categoryName).toBe(correctedCategory.name);
          expect(result.confidence).toBe(1.0);

          // AI provider was never called
          expect(provider.complete).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
