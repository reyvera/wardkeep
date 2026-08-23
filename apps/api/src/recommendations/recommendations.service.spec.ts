import { describe, expect, it } from 'vitest';

import { recommendationCandidate } from './recommendations.service';

describe('recommendationCandidate', () => {
  it('creates a stable, high-priority action for a confirmed risk', () => {
    const signal = {
      capabilityId: 'emergency-fund',
      type: 'risk' as const,
      magnitude: -7,
      pillar: 'protection' as const,
      summary: 'Liquid reserves are limited.',
      provenance: {
        limitation: 'This measures cash resilience only.',
        evidenceState: 'synchronized' as const,
      },
    };

    const first = recommendationCandidate(signal);
    const second = recommendationCandidate(signal);

    expect(first).toMatchObject({
      action: 'Review liquid accounts',
      actionHref: '/accounts',
      priority: 'critical',
    });
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('reduces priority when the source evidence is stale', () => {
    const current = recommendationCandidate({
      capabilityId: 'budgets',
      type: 'warning',
      magnitude: -5,
      pillar: 'provision',
      summary: 'Budget pace needs review.',
      provenance: { limitation: 'Transactions can be incomplete.', evidenceState: 'synchronized' },
    });
    const stale = recommendationCandidate({
      capabilityId: 'budgets',
      type: 'warning',
      magnitude: -5,
      pillar: 'provision',
      summary: 'Budget pace needs review.',
      provenance: { limitation: 'Transactions can be incomplete.', evidenceState: 'stale' },
    });

    expect(stale.priorityScore).toBeLessThan(current.priorityScore);
  });
});
