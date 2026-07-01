// Types
export type { CompletionOptions, AIPrivacyMode, CategorySuggestion, AIResponse } from './types';

// Providers
export type { AIProvider } from './providers/ai-provider';
export { OllamaProvider } from './providers/ollama-provider';
export { OpenAIProvider } from './providers/openai-provider';
export { AnthropicProvider } from './providers/anthropic-provider';

// Circuit breaker
export { CircuitBreaker } from './circuit-breaker';
export type { CircuitState } from './circuit-breaker';

// Privacy routing
export { PrivacyRouter, isSensitiveQuery } from './privacy-router';

// AI Categorization
export { AICategorizer, AI_CONFIDENCE_AUTO_ASSIGN, AI_CONFIDENCE_SUGGEST } from './categorizer';
export type { CategorizationInput, CategoryRef } from './categorizer';

// AI Chat
export { AIChat } from './chat';
export type { ChatMessage } from './chat';
