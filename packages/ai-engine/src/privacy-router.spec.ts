import { describe, it, expect, vi } from 'vitest';

import { PrivacyRouter, isSensitiveQuery } from './privacy-router';
import { AIProvider } from './providers/ai-provider';

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
