/**
 * Privacy router — selects the appropriate AI provider based on privacy mode
 * and whether a query contains sensitive financial data.
 */
import { AIPrivacyMode } from './types';
import { AIProvider } from './providers/ai-provider';

/** Patterns that indicate sensitive financial data. */
const SENSITIVE_PATTERNS: RegExp[] = [
  /balance/i,
  /amount/i,
  /account.*number/i,
  /\$\d/i,
  /income/i,
  /debt/i,
  /payment/i,
  /salary/i,
];

/**
 * Determine whether a query contains sensitive financial information
 * that should not be sent to cloud providers.
 * @param query - The user's query text.
 * @returns True if the query matches any sensitive pattern.
 */
export function isSensitiveQuery(query: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(query));
}

/**
 * Routes AI requests to the appropriate provider based on the configured
 * privacy mode and sensitivity of the query.
 */
export class PrivacyRouter {
  constructor(
    private mode: AIPrivacyMode,
    private localProvider: AIProvider,
    private cloudProvider: AIProvider | null,
  ) {}

  /**
   * Get the appropriate provider for a request.
   * @param isSensitive - Whether the query contains sensitive financial data.
   * @returns The selected provider, or null if no provider is available.
   */
  getProvider(isSensitive: boolean): AIProvider | null {
    switch (this.mode) {
      case 'LOCAL':
        return this.localProvider;
      case 'CLOUD':
        return this.cloudProvider;
      case 'HYBRID':
        return isSensitive ? this.localProvider : (this.cloudProvider ?? this.localProvider);
    }
  }

  /**
   * Update the privacy mode at runtime.
   * @param mode - The new privacy mode to use.
   */
  setMode(mode: AIPrivacyMode): void {
    this.mode = mode;
  }
}
