import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(5, 60000);
  });

  it('should execute a successful function and return the result', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('should propagate errors without opening the circuit below threshold', async () => {
    const fn = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 4; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('closed');
  });

  it('should open after 5 consecutive failures', async () => {
    const fn = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('open');
  });

  it('should reject immediately when open', async () => {
    const fn = () => Promise.reject(new Error('fail'));

    // Trip the breaker
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker is open',
    );
  });

  it('should reset to closed after cooldown and a successful call', async () => {
    const fn = () => Promise.reject(new Error('fail'));

    // Trip the breaker
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('open');

    // Advance time past cooldown
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

    expect(breaker.getState()).toBe('half-open');

    // Successful call resets the breaker
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('closed');

    vi.restoreAllMocks();
  });

  it('should reset failure count on a successful call', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    const succeed = () => Promise.resolve('ok');

    // 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('fail');
    }

    // Success resets count
    await breaker.execute(succeed);

    // 4 more failures should not trip (count reset)
    for (let i = 0; i < 4; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('closed');
  });
});
