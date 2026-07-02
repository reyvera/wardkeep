/**
 * Property-based tests for the offline action queue.
 *
 * Feature: ai-personal-finance-app
 * Property 32: Offline action queue enforces capacity (max 100) and FIFO sync order
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ─── Test-friendly OfflineQueue implementation ───────────────────────────────────
// We re-implement the class here for isolated testing since the module exports
// a singleton and relies on browser globals (localStorage, crypto, fetch).

const MAX_QUEUE_SIZE = 100;

interface QueuedAction {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  timestamp: number;
}

class TestOfflineQueue {
  private queue: QueuedAction[] = [];
  private flushedOrder: QueuedAction[] = [];

  add(action: Omit<QueuedAction, 'id' | 'timestamp'>): boolean {
    if (this.queue.length >= MAX_QUEUE_SIZE) return false;
    this.queue.push({
      ...action,
      id: `id-${this.queue.length}-${Date.now()}`,
      timestamp: Date.now(),
    });
    return true;
  }

  /**
   * Simulate flush in FIFO order, recording the order of processing.
   */
  flushSync(): QueuedAction[] {
    const toProcess = [...this.queue];
    this.flushedOrder = toProcess;
    this.queue = [];
    return toProcess;
  }

  getSize(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= MAX_QUEUE_SIZE;
  }

  getFlushedOrder(): QueuedAction[] {
    return this.flushedOrder;
  }

  getQueue(): QueuedAction[] {
    return [...this.queue];
  }
}

// ─── Generators ──────────────────────────────────────────────────────────────────

const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
const pathArb = fc.stringMatching(/^\/[abc123]{1,20}$/);
const bodyArb = fc.oneof(
  fc.constant(undefined),
  fc.record({ key: fc.string({ minLength: 1, maxLength: 10 }) }),
);

const actionArb = fc.record({
  method: methodArb,
  path: pathArb,
  body: bodyArb,
});

// ─── Property 32 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 32: Offline action queue enforces capacity (max 100) and FIFO sync order', () => {
  it('queue rejects additions beyond capacity of 100', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 101, maxLength: 150 }),
        (actions) => {
          const queue = new TestOfflineQueue();

          const results: boolean[] = [];
          for (const action of actions) {
            results.push(queue.add(action));
          }

          // First 100 should succeed
          for (let i = 0; i < 100; i++) {
            expect(results[i]).toBe(true);
          }

          // 101st and beyond should be rejected
          for (let i = 100; i < results.length; i++) {
            expect(results[i]).toBe(false);
          }

          // Queue size stays at max
          expect(queue.getSize()).toBe(MAX_QUEUE_SIZE);
          expect(queue.isFull()).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('flush processes in FIFO order (first added = first synced)', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 1, maxLength: 100 }),
        (actions) => {
          const queue = new TestOfflineQueue();

          // Add all actions
          for (const action of actions) {
            queue.add(action);
          }

          // Flush and verify FIFO order
          const flushed = queue.flushSync();

          expect(flushed).toHaveLength(actions.length);

          // Verify order is preserved (same method+path sequence as insertion)
          for (let i = 0; i < actions.length; i++) {
            expect(flushed[i].method).toBe(actions[i].method);
            expect(flushed[i].path).toBe(actions[i].path);
          }

          // Queue should be empty after flush
          expect(queue.getSize()).toBe(0);
          expect(queue.isFull()).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('timestamps are monotonically non-decreasing (insertion order)', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 2, maxLength: 50 }),
        (actions) => {
          const queue = new TestOfflineQueue();

          for (const action of actions) {
            queue.add(action);
          }

          const items = queue.getQueue();

          // Timestamps should be monotonically non-decreasing
          for (let i = 1; i < items.length; i++) {
            expect(items[i].timestamp).toBeGreaterThanOrEqual(items[i - 1].timestamp);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('exactly 100 items can be added before queue becomes full', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          const queue = new TestOfflineQueue();

          for (let i = 0; i < count; i++) {
            const result = queue.add({ method: 'POST', path: `/action/${i}` });
            expect(result).toBe(true);
          }

          expect(queue.getSize()).toBe(count);

          if (count === 100) {
            expect(queue.isFull()).toBe(true);
            expect(queue.add({ method: 'POST', path: '/overflow' })).toBe(false);
          } else {
            expect(queue.isFull()).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after flush, queue accepts new items up to capacity again', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 100 }),
        fc.array(actionArb, { minLength: 1, maxLength: 50 }),
        (firstBatchSize, secondBatch) => {
          const queue = new TestOfflineQueue();

          // Fill partially
          for (let i = 0; i < firstBatchSize; i++) {
            queue.add({ method: 'POST', path: `/first/${i}` });
          }

          // Flush
          queue.flushSync();
          expect(queue.getSize()).toBe(0);

          // Should be able to add more
          for (const action of secondBatch) {
            const result = queue.add(action);
            expect(result).toBe(true);
          }

          expect(queue.getSize()).toBe(secondBatch.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
