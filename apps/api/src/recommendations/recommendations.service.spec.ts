import { describe, expect, it, vi } from 'vitest';

import { RecommendationsService, recommendationCandidate } from './recommendations.service';

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
    expect(first.confidence.toFixed(2)).toBe('1.00');
    expect(first.supportingData).toContain('Current Wardkeep records');
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
    expect(stale.confidence.toFixed(2)).toBe('0.50');
  });

  it('previews a pillar-only improvement when other observed factors remain', () => {
    const risk = {
      capabilityId: 'emergency-fund',
      type: 'risk' as const,
      magnitude: -6,
      pillar: 'protection' as const,
      summary: 'Reserves are limited.',
      provenance: { limitation: 'Cash resilience only.', evidenceState: 'synchronized' as const },
    };
    const candidate = recommendationCandidate(risk, [
      risk,
      {
        capabilityId: 'insurance',
        type: 'positive',
        magnitude: 1,
        pillar: 'protection',
        summary: 'Policy recorded.',
      },
    ]);

    expect(candidate.projectedPillarDelta).toBeGreaterThan(0);
    expect(candidate.impactPreview).toContain('could increase');
  });

  it('persists recorded financial context without inventing missing timing', () => {
    const candidate = recommendationCandidate({
      capabilityId: 'emergency-fund',
      type: 'warning',
      magnitude: -4,
      pillar: 'protection',
      summary: 'Reserves need attention.',
      financialImpact: { amount: '1200.00', label: 'Recorded reserve target gap' },
      provenance: { limitation: 'Cash resilience only.', evidenceState: 'synchronized' },
    });

    expect(candidate.estimatedAmount?.toFixed(2)).toBe('1200.00');
    expect(candidate.estimatedAmountLabel).toBe('Recorded reserve target gap');
    expect(candidate.estimatedCompletionDays).toBeNull();
  });
});

describe('RecommendationsService completion observations', () => {
  it('records the latest observed readiness score when an action is completed', async () => {
    const prisma = {
      recommendation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rec-1' }),
        update: vi.fn().mockResolvedValue({ id: 'rec-1' }),
      },
      readinessSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ overall: 64, recordedAt: new Date('2026-08-26') }),
      },
    };
    const service = new RecommendationsService(prisma as never);

    await service.updateStatus('user-1', 'rec-1', 'COMPLETED');

    expect(prisma.recommendation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoreAtCompletion: 64 }),
      }),
    );
  });

  it('reports observed score movement since completion without attributing causation', async () => {
    const prisma = {
      recommendation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'rec-1', status: 'COMPLETED', scoreAtCompletion: 64 },
        ]),
      },
      readinessSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ overall: 67, recordedAt: new Date('2026-08-27') }),
      },
    };
    const service = new RecommendationsService(prisma as never);

    await expect(service.list('user-1')).resolves.toMatchObject([
      { id: 'rec-1', scoreChangeSinceCompletion: 3 },
    ]);
  });
});
