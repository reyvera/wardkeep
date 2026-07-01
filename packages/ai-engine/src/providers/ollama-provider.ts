/**
 * Ollama local LLM provider — connects to a local Ollama instance.
 */
import { CompletionOptions } from '../types';
import { CircuitBreaker } from '../circuit-breaker';
import { AIProvider } from './ai-provider';

/** Default Ollama endpoint for local development. */
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/** Default model for categorization and chat. */
const DEFAULT_MODEL = 'llama3:8b';

export class OllamaProvider implements AIProvider {
  public readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL, model: string = DEFAULT_MODEL) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Send a prompt to the local Ollama instance.
   * @param prompt - The user prompt.
   * @param options - Completion options (maxTokens, temperature, systemPrompt).
   * @returns Generated text response.
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const fullPrompt = options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            num_predict: options?.maxTokens ?? 512,
            temperature: options?.temperature ?? 0.3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    });
  }

  /**
   * Check if Ollama is running by hitting the tags endpoint.
   * @returns True if Ollama responds successfully.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
