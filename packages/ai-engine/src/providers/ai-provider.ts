/**
 * Abstract interface for all AI providers.
 */
import { CompletionOptions } from '../types';

/** Provider abstraction for LLM interactions. */
export interface AIProvider {
  /** Display name of the provider. */
  name: string;

  /**
   * Send a prompt to the LLM and receive a text completion.
   * @param prompt - The user prompt to complete.
   * @param options - Optional completion parameters.
   * @returns The generated text response.
   */
  complete(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Check whether the provider is currently reachable.
   * @returns True if the provider can accept requests.
   */
  isAvailable(): Promise<boolean>;
}
