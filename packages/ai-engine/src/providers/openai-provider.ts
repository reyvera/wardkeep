/**
 * OpenAI cloud provider — calls OpenAI's chat completions API.
 */
import { CompletionOptions } from '../types';
import { AIProvider } from './ai-provider';

/** Default OpenAI model. */
const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Send a completion request to the OpenAI API.
   * @param prompt - The user prompt.
   * @param options - Completion options.
   * @returns Generated text response.
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const messages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options?.maxTokens ?? 512,
        temperature: options?.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message.content ?? '';
  }

  /**
   * Check availability by verifying the API key is configured.
   * @returns True if an API key is present.
   */
  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}
