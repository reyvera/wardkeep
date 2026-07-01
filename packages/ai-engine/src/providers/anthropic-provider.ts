/**
 * Anthropic cloud provider — calls Anthropic's messages API.
 */
import { CompletionOptions } from '../types';
import { AIProvider } from './ai-provider';

/** Default Anthropic model. */
const DEFAULT_MODEL = 'claude-3-haiku-20240307';

export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Send a completion request to the Anthropic API.
   * @param prompt - The user prompt.
   * @param options - Completion options.
   * @returns Generated text response.
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 512,
        system: options?.systemPrompt ?? '',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    return data.content[0]?.text ?? '';
  }

  /**
   * Check availability by verifying the API key is configured.
   * @returns True if an API key is present.
   */
  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}
