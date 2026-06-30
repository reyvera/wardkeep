# AI Integration Guidelines

inclusion: auto

## Local Development

- Default AI Privacy Mode: **Local** (Ollama)
- Preferred model: `llama3:8b` (good balance of speed and capability for categorization/chat)
- Alternative: `mistral:7b` for faster responses, `qwen2:7b` for multilingual support
- Minimum context window: 4096 tokens
- Ollama endpoint: `http://localhost:11434` (or `http://ollama:11434` in Docker)

## Provider Architecture

- `AIProvider` interface abstracts all LLM interactions
- Implementations: `OllamaProvider`, `OpenAIProvider`, `AnthropicProvider`
- Privacy mode router selects provider based on `AI_PRIVACY_MODE` env var
- Circuit breaker: open after 5 consecutive failures, 60-second cooldown

## Privacy Mode Rules

| Mode | Behavior |
|------|----------|
| LOCAL | All requests → Ollama. Zero external calls. Queue if Ollama down. |
| HYBRID | Sensitive data (balances, amounts, account numbers, merchants) → Ollama. General explanations → cloud. |
| CLOUD | All requests → configured cloud provider. Requires explicit user consent. |

**Critical:** In LOCAL or HYBRID mode, NEVER fall back to cloud if Ollama is unavailable. Queue the request and notify the user.

## Sensitive Data Classification

These are NEVER sent to cloud in LOCAL or HYBRID mode:
- Account balances and numbers
- Transaction amounts and merchant names
- Personal financial information (income, debt amounts)
- Budget allocations and spending details

## Categorization Prompting

- Provide: merchant name, amount, description, user's category list
- Request: single category name + confidence score (0.00–1.00)
- Check AICorrection table first — if user has corrected this merchant before, use that
- Structured output format (JSON) for reliable parsing

## Chat Prompting

- System prompt establishes financial assistant role with boundaries
- Include user's financial context (account summary, recent spending, budget status)
- NEVER recommend specific products, securities, or provide tax advice
- Always pass numerical claims through Finance Engine verification
- Maintain rolling 10-message history per session

## Testing AI Components

- Mock LLM responses in unit tests (deterministic test data)
- Test confidence routing with known scores (0.3, 0.6, 0.9)
- Test privacy mode enforcement (verify no external calls in LOCAL mode)
- Use real Ollama for local integration tests (not in CI — too slow)
- In CI: mock all AI providers for speed and determinism
