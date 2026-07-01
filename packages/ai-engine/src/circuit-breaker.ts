/**
 * Circuit breaker pattern — prevents cascading failures when an
 * AI provider is unresponsive by short-circuiting requests.
 */

/** Circuit breaker states. */
export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private isOpen = false;

  /**
   * @param threshold - Number of consecutive failures before opening the circuit.
   * @param cooldownMs - Time in ms before allowing a retry (half-open state).
   */
  constructor(
    private readonly threshold: number = 5,
    private readonly cooldownMs: number = 60000,
  ) {}

  /**
   * Execute a function through the circuit breaker.
   * @param fn - The async operation to execute.
   * @returns The result of the operation.
   * @throws When the circuit is open or the underlying operation fails.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen && Date.now() - this.lastFailure < this.cooldownMs) {
      throw new Error('Circuit breaker is open');
    }

    // Half-open → reset and try
    if (this.isOpen) {
      this.isOpen = false;
      this.failures = 0;
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.isOpen = true;
      }
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker.
   * @returns 'closed' (healthy), 'open' (tripped), or 'half-open' (cooldown elapsed).
   */
  getState(): CircuitState {
    if (!this.isOpen) {
      return 'closed';
    }
    if (Date.now() - this.lastFailure >= this.cooldownMs) {
      return 'half-open';
    }
    return 'open';
  }
}
