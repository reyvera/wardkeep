/**
 * AI-powered transaction categorization with confidence scoring.
 * Checks user corrections first, then falls back to LLM classification.
 */
import { AI_CONFIDENCE_AUTO_ASSIGN, AI_CONFIDENCE_SUGGEST } from '@budgetapp/shared';

import { CategorySuggestion } from './types';
import { AIProvider } from './providers/ai-provider';

/** Re-export thresholds for convenience. */
export { AI_CONFIDENCE_AUTO_ASSIGN, AI_CONFIDENCE_SUGGEST };

/** Minimal transaction data needed for categorization. */
export interface CategorizationInput {
  merchant: string | null;
  amount: string;
  description: string | null;
}

/** Category reference for prompt construction. */
export interface CategoryRef {
  id: string;
  name: string;
}

/**
 * AI categorizer — assigns categories to transactions using LLM
 * with a corrections-first approach.
 */
export class AICategorizer {
  constructor(private readonly provider: AIProvider) {}

  /**
   * Categorize a single transaction.
   * @param transaction - The transaction to categorize.
   * @param categories - Available categories.
   * @param corrections - Map of merchant name → corrected category ID.
   * @returns Category suggestion with confidence score.
   */
  async categorize(
    transaction: CategorizationInput,
    categories: CategoryRef[],
    corrections: Map<string, string>,
  ): Promise<CategorySuggestion> {
    // Check corrections map first
    if (transaction.merchant) {
      const correctedCategoryId = corrections.get(transaction.merchant.toLowerCase());
      if (correctedCategoryId) {
        const category = categories.find((c) => c.id === correctedCategoryId);
        if (category) {
          return {
            categoryId: category.id,
            categoryName: category.name,
            confidence: 1.0,
          };
        }
      }
    }

    // Build prompt and call AI
    const prompt = this.buildCategorizationPrompt(transaction, categories);

    try {
      const response = await this.provider.complete(prompt, {
        temperature: 0.1,
        maxTokens: 100,
        systemPrompt:
          'You are a financial transaction categorizer. Respond ONLY with valid JSON.',
      });

      return this.parseCategorizationResponse(response, categories);
    } catch {
      return { categoryId: '', categoryName: 'Uncategorized', confidence: 0.0 };
    }
  }

  /**
   * Categorize multiple transactions in batch.
   * @param transactions - Array of transactions to categorize.
   * @param categories - Available categories.
   * @param corrections - Map of merchant name → corrected category ID.
   * @returns Array of category suggestions.
   */
  async batchCategorize(
    transactions: CategorizationInput[],
    categories: CategoryRef[],
    corrections: Map<string, string>,
  ): Promise<CategorySuggestion[]> {
    return Promise.all(
      transactions.map((tx) => this.categorize(tx, categories, corrections)),
    );
  }

  /** Build the prompt with transaction details and category list. */
  private buildCategorizationPrompt(
    transaction: CategorizationInput,
    categories: CategoryRef[],
  ): string {
    const categoryList = categories.map((c) => c.name).join(', ');
    const merchant = transaction.merchant ?? 'Unknown';
    const description = transaction.description ?? 'No description';

    return [
      `Categorize this transaction into one of the following categories: [${categoryList}]`,
      '',
      `Merchant: ${merchant}`,
      `Amount: ${transaction.amount}`,
      `Description: ${description}`,
      '',
      'Respond with JSON: { "category": "category name", "confidence": 0.XX }',
    ].join('\n');
  }

  /** Parse the LLM response into a CategorySuggestion. */
  private parseCategorizationResponse(
    response: string,
    categories: CategoryRef[],
  ): CategorySuggestion {
    try {
      // Extract JSON from the response (may have extra text around it)
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        return { categoryId: '', categoryName: 'Uncategorized', confidence: 0.0 };
      }

      const parsed = JSON.parse(jsonMatch[0]) as { category?: string; confidence?: number };
      const categoryName = parsed.category ?? '';
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.0;

      // Match to a known category
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
      );

      if (!matchedCategory) {
        return { categoryId: '', categoryName: 'Uncategorized', confidence: 0.0 };
      }

      return {
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch {
      return { categoryId: '', categoryName: 'Uncategorized', confidence: 0.0 };
    }
  }
}
