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
    const scoreArbitrary = fc.integer({ min: 0, max: 100 });
    const weightsArbitrary = fc.record({
      protection: fc.double({ min: 0.01, max: 5, noNaN: true }),
      provision: fc.double({ min: 0.01, max: 5, noNaN: true }),
      preparation: fc.double({ min: 0.01, max: 5, noNaN: true }),
      prosperity: fc.double({ min: 0.01, max: 5, noNaN: true }),
    });

    fc.assert(
      fc.property(
        fc.record({
          protection: scoreArbitrary,
          provision: scoreArbitrary,
          preparation: scoreArbitrary,
          prosperity: scoreArbitrary,
        }),
        weightsArbitrary,
        (scores, weights) => {
          const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
          const expected = Math.round(
            (scores.protection * weights.protection +
              scores.provision * weights.provision +
              scores.preparation * weights.preparation +
              scores.prosperity * weights.prosperity) /
              totalWeight,
          );

          expect(computeOverallReadiness(scores, weights)).toBe(expected);
        },
      ),
    );
  });

  it('derives peace from the least-ready pillar and penalizes volatility', () => {
    const scoreArbitrary = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(
        fc.record({
          protection: scoreArbitrary,
          provision: scoreArbitrary,
          preparation: scoreArbitrary,
          prosperity: scoreArbitrary,
        }),
        fc.array(scoreArbitrary, { minLength: 2, maxLength: 7 }),
        (pillars, overallHistory) => {
          const lowestPillar = Math.min(...Object.values(pillars));
          const recentHistory = overallHistory.slice(-7);
          const totalChange = recentHistory.slice(1).reduce(
            (total, score, index) => total + Math.abs(score - recentHistory[index]!),
            0,
          );
          const expected = Math.round(
            Math.max(0, Math.min(100, lowestPillar - Math.min(20, totalChange / (recentHistory.length - 1)))),
          );
          const history = recentHistory.map((overall, index) => ({
            overall,
            pillars: { ...pillars, peace: lowestPillar },
            recordedAt: new Date(2026, 0, index + 1),
          }));

          expect(computePeace(pillars, history)).toBe(expected);
        },
      ),
    );
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
