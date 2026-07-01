/**
 * Shared types for the AI Engine package.
 */

/** Options for LLM completion requests. */
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/** Privacy mode controlling where AI requests are routed. */
export type AIPrivacyMode = 'LOCAL' | 'HYBRID' | 'CLOUD';

/** A suggested category with confidence score. */
export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  /** Confidence score between 0.00 and 1.00. */
  confidence: number;
}

/** Response from AI chat including optional numerical claims for verification. */
export interface AIResponse {
  content: string;
  numericalClaims?: { type: string; value: string }[];
}
