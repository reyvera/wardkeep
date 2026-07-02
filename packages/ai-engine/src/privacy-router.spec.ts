import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

import { PrivacyRouter, isSensitiveQuery } from './privacy-router';
import { AIProvider } from './providers/ai-provider';
import { AIPrivacyMode } from './types';

function createMockProvider(name: string): AIProvider {
  return {
    name,
    complete: vi.fn().mockResolvedValue('response'),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

describe('isSensitiveQuery', () => {
  it('should detect balance queries as sensitive', () => {
    expect(isSensitiveQuery('What is my account balance?')).toBe(true);
  });

  it('should detect dollar amounts as sensitive', () => {
    expect(isSensitiveQuery('I spent $50 yesterday')).toBe(true);
  });

  it('should detect income mentions as sensitive', () => {
    expect(isSensitiveQuery('My monthly income is high')).toBe(true);
  });

  it('should detect debt mentions as sensitive', () => {
    expect(isSensitiveQuery('How do I pay off my debt?')).toBe(true);
  });

  it('should detect salary mentions as sensitive', () => {
    expect(isSensitiveQuery('When does my salary arrive?')).toBe(true);
  });

  it('should not flag generic questions as sensitive', () => {
    expect(isSensitiveQuery('How do I create a budget?')).toBe(false);
  });

  it('should not flag category questions as sensitive', () => {
    expect(isSensitiveQuery('What categories do I have?')).toBe(false);
  });
});

describe('PrivacyRouter', () => {
  const localProvider = createMockProvider('ollama');
  const cloudProvider = createMockProvider('openai');

  describe('LOCAL mode', () => {
    it('should always return local provider regardless of sensitivity', () => {
      const router = new PrivacyRouter('LOCAL', localProvider, cloudProvider);

      expect(router.getProvider(true)).toBe(localProvider);
      expect(router.getProvider(false)).toBe(localProvider);
    });
  });

  describe('CLOUD mode', () => {
    it('should always return cloud provider regardless of sensitivity', () => {
      const router = new PrivacyRouter('CLOUD', localProvider, cloudProvider);

      expect(router.getProvider(true)).toBe(cloudProvider);
      expect(router.getProvider(false)).toBe(cloudProvider);
    });
  });

  describe('HYBRID mode', () => {
    it('should return local provider for sensitive queries', () => {
      const router = new PrivacyRouter('HYBRID', localProvider, cloudProvider);

      expect(router.getProvider(true)).toBe(localProvider);
    });

    it('should return cloud provider for non-sensitive queries', () => {
      const router = new PrivacyRouter('HYBRID', localProvider, cloudProvider);

      expect(router.getProvider(false)).toBe(cloudProvider);
    });

    it('should fall back to local if cloud is null for non-sensitive queries', () => {
      const router = new PrivacyRouter('HYBRID', localProvider, null);

      expect(router.getProvider(false)).toBe(localProvider);
    });
  });

  describe('setMode', () => {
    it('should change routing behavior when mode is updated', () => {
      const router = new PrivacyRouter('LOCAL', localProvider, cloudProvider);

      expect(router.getProvider(false)).toBe(localProvider);

      router.setMode('CLOUD');
      expect(router.getProvider(false)).toBe(cloudProvider);
    });
  });
});


// ─── Property-Based Tests ────────────────────────────────────────────────────────

// ─── Property 29 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 29: AI Privacy Mode enforces routing constraints (Local mode never calls cloud)', () => {
  it('LOCAL mode always returns local provider regardless of query sensitivity', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isSensitive
        fc.string({ minLength: 1, maxLength: 100 }), // arbitrary query text
        (isSensitive) => {
          const localProvider = createMockProvider('ollama-local');
          const cloudProvider = createMockProvider('openai-cloud');

          const router = new PrivacyRouter('LOCAL', localProvider, cloudProvider);
          const selected = router.getProvider(isSensitive);

          // In LOCAL mode, cloud provider is NEVER selected
          expect(selected).toBe(localProvider);
          expect(selected).not.toBe(cloudProvider);
          expect(selected?.name).toBe('ollama-local');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('LOCAL mode never returns cloud even when cloud is the only non-null provider', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isSensitive
        (isSensitive) => {
          const localProvider = createMockProvider('ollama-local');
          // Cloud is provided but should still be ignored in LOCAL mode
          const cloudProvider = createMockProvider('openai-cloud');

          const router = new PrivacyRouter('LOCAL', localProvider, cloudProvider);
          const selected = router.getProvider(isSensitive);

          expect(selected?.name).toBe('ollama-local');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('HYBRID mode routes sensitive queries to local, never to cloud', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // always sensitive
        (_isSensitive) => {
          const localProvider = createMockProvider('ollama-local');
          const cloudProvider = createMockProvider('openai-cloud');

          const router = new PrivacyRouter('HYBRID', localProvider, cloudProvider);
          const selected = router.getProvider(true);

          // Sensitive data MUST go to local
          expect(selected).toBe(localProvider);
          expect(selected).not.toBe(cloudProvider);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CLOUD mode always routes to cloud regardless of sensitivity', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isSensitive
        (isSensitive) => {
          const localProvider = createMockProvider('ollama-local');
          const cloudProvider = createMockProvider('openai-cloud');

          const router = new PrivacyRouter('CLOUD', localProvider, cloudProvider);
          const selected = router.getProvider(isSensitive);

          expect(selected).toBe(cloudProvider);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('mode transitions preserve routing invariants', () => {
    const modeArb = fc.constantFrom<AIPrivacyMode>('LOCAL', 'HYBRID', 'CLOUD');

    fc.assert(
      fc.property(
        fc.array(modeArb, { minLength: 1, maxLength: 10 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        (modes, sensitivities) => {
          const localProvider = createMockProvider('ollama-local');
          const cloudProvider = createMockProvider('openai-cloud');
          const router = new PrivacyRouter('LOCAL', localProvider, cloudProvider);

          for (let i = 0; i < modes.length; i++) {
            const mode = modes[i];
            const isSensitive = sensitivities[i % sensitivities.length];

            router.setMode(mode);
            const selected = router.getProvider(isSensitive);

            // Core invariant: LOCAL mode NEVER returns cloud
            if (mode === 'LOCAL') {
              expect(selected).toBe(localProvider);
            }

            // Core invariant: HYBRID + sensitive NEVER returns cloud
            if (mode === 'HYBRID' && isSensitive) {
              expect(selected).toBe(localProvider);
            }

            // Cloud mode always returns cloud
            if (mode === 'CLOUD') {
              expect(selected).toBe(cloudProvider);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
