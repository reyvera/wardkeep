/**
 * AI Chat — conversational financial assistant with claim extraction.
 * Numerical claims are extracted for downstream verification by the Finance Engine.
 */
import { AIResponse } from './types';
import { AIProvider } from './providers/ai-provider';

/** Maximum allowed query length. */
const MAX_QUERY_LENGTH = 500;

/** Maximum number of history messages to include in context. */
const MAX_HISTORY_MESSAGES = 10;

/** System prompt establishing boundaries for the financial assistant. */
const SYSTEM_PROMPT = [
  'You are a helpful personal finance assistant.',
  'You help users understand their spending, budgets, and financial health.',
  'Rules you MUST follow:',
  '- NEVER recommend specific financial products, securities, or investments.',
  '- NEVER provide tax advice or act as a tax professional.',
  '- NEVER recommend specific insurance products.',
  '- Be concise and factual.',
  '- When referencing numbers, state them clearly.',
  '- If you are unsure, say so rather than making up data.',
].join('\n');

/** A message in the conversation history. */
export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * AI chat engine — processes user queries about their finances
 * and extracts numerical claims for verification.
 */
export class AIChat {
  constructor(private readonly provider: AIProvider) {}

  /**
   * Process a chat query with financial context and history.
   * @param query - The user's question (max 500 chars).
   * @param financialContext - Summary of the user's financial state.
   * @param history - Previous messages in the conversation.
   * @returns AI response with extracted numerical claims.
   * @throws When query is empty or exceeds max length.
   */
  async chat(
    query: string,
    financialContext: string,
    history: ChatMessage[],
  ): Promise<AIResponse> {
    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error('Query must not be empty');
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error(`Query must not exceed ${MAX_QUERY_LENGTH} characters`);
    }

    // Build the full prompt with context and history
    const prompt = this.buildPrompt(query, financialContext, history);

    const content = await this.provider.complete(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 1024,
    });

    // Extract numerical claims from the response
    const numericalClaims = this.extractNumericalClaims(content);

    return { content, numericalClaims };
  }

  /** Build a combined prompt with financial context and conversation history. */
  private buildPrompt(
    query: string,
    financialContext: string,
    history: ChatMessage[],
  ): string {
    const parts: string[] = [];

    if (financialContext) {
      parts.push(`Financial context:\n${financialContext}`);
    }

    // Include last N history messages
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
    if (recentHistory.length > 0) {
      const historyText = recentHistory
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');
      parts.push(`Conversation history:\n${historyText}`);
    }

    parts.push(`User question: ${query}`);

    return parts.join('\n\n');
  }

  /**
   * Extract numerical claims (dollar amounts, percentages) from AI response.
   * These are flagged for independent verification by the Finance Engine.
   */
  private extractNumericalClaims(
    content: string,
  ): { type: string; value: string }[] {
    const claims: { type: string; value: string }[] = [];

    // Match dollar amounts like $1,234.56 or $50
    const dollarPattern = /\$[\d,]+(?:\.\d{1,2})?/g;
    const dollarMatches = content.match(dollarPattern);
    if (dollarMatches) {
      for (const match of dollarMatches) {
        claims.push({ type: 'dollar_amount', value: match });
      }
    }

    // Match percentage values like 45% or 12.5%
    const percentPattern = /\d+(?:\.\d+)?%/g;
    const percentMatches = content.match(percentPattern);
    if (percentMatches) {
      for (const match of percentMatches) {
        claims.push({ type: 'percentage', value: match });
      }
    }

    return claims;
  }
}
