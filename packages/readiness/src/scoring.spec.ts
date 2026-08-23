import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { computeOverallReadiness, computePeace, computePillarScore } from './scoring';
import type { Signal } from './types';

const pillars = ['protection', 'provision', 'preparation', 'prosperity'] as const;
const signalArbitrary = fc.record({
  capabilityId: fc.string({ minLength: 1 }),
  type: fc.constantFrom('risk', 'opportunity', 'milestone', 'warning', 'positive'),
  magnitude: fc.double({ min: -100, max: 100, noNaN: true }),
  pillar: fc.constantFrom(...pillars),
  summary: fc.string(),
  weight: fc.option(fc.double({ min: -5, max: 5, noNaN: true }), { nil: undefined }),
}) as fc.Arbitrary<Signal>;

describe('Readiness Engine scoring', () => {
  it('is deterministic for identical signals', () => {
    fc.assert(
      fc.property(fc.array(signalArbitrary), (signals) => {
        expect(computePillarScore('provision', signals)).toBe(
          computePillarScore('provision', signals),
        );
      }),
    );
  });

  it('computes the weighted average of pillar scores', () => {
    expect(
      computeOverallReadiness(
        { protection: 80, provision: 60, preparation: 100, prosperity: 80 },
        {
          protection: 1,
          provision: 2,
          preparation: 1,
          prosperity: 0,
        },
      ),
    ).toBe(75);
  });

  it('derives peace from the least-ready pillar and penalizes volatility', () => {
    const pillars = { protection: 90, provision: 80, preparation: 95, prosperity: 85 };
    expect(computePeace(pillars)).toBe(80);
    expect(
      computePeace(pillars, [
        { overall: 80, pillars: { ...pillars, peace: 80 }, recordedAt: new Date('2026-01-01') },
        { overall: 60, pillars: { ...pillars, peace: 80 }, recordedAt: new Date('2026-01-02') },
      ]),
    ).toBe(60);
  });

  it('derives peace from observed pillars without treating an omitted pillar as zero', () => {
    expect(computePeace({ protection: 47, provision: 61, prosperity: 100 })).toBe(47);
  });

  it('does not treat an unevaluated pillar as perfectly ready', () => {
    expect(computePillarScore('provision', [])).toBe(0);
  });

  it('bounds all signal magnitudes and resulting scores', () => {
    fc.assert(
      fc.property(fc.array(signalArbitrary), (signals) => {
        const score = computePillarScore('prosperity', signals);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }),
    );
  });
});
