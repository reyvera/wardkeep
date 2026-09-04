import { describe, expect, it, vi } from 'vitest';

import { ReadinessService, ReadinessResponse } from './readiness.service';

describe('ReadinessService explanations', () => {
  it('identifies Peace as derived rather than a missing factor', async () => {
    const service = new ReadinessService({} as never, {} as never);
    vi.spyOn(service, 'getReadiness').mockResolvedValue({
      evaluatedAt: new Date('2026-09-03T00:00:00.000Z'),
      modelVersion: 2,
      model: {
        effectiveDate: '2026-09-03',
        directWeights: { protection: 0.35, provision: 0.35, prosperity: 0.3 },
        peaceIsDerived: true,
      },
      overall: 75,
      pillars: { protection: 75, provision: 80, prosperity: 70, peace: 70 },
      signals: [],
      topRisks: [],
      topOpportunities: [],
      history: [],
      trendWindows: [],
      pillarTrends: {},
      overallAssessment: {
        state: 'known',
        score: 75,
        coverage: 100,
        evaluatedCapabilities: ['protection', 'provision', 'prosperity'],
      },
      coverage: 100,
      pillarCoverage: { protection: 100, provision: 100, prosperity: 100 },
      pillarAssessments: {
        protection: { state: 'known', score: 75, coverage: 100, evaluatedCapabilities: [] },
        provision: { state: 'known', score: 80, coverage: 100, evaluatedCapabilities: [] },
        prosperity: { state: 'known', score: 70, coverage: 100, evaluatedCapabilities: [] },
        peace: { state: 'known', score: 70, coverage: 100, evaluatedCapabilities: [] },
      },
      dataFreshness: {
        synchronizedAccounts: 0,
        manualAccounts: 0,
        staleAccounts: 0,
        lastSynchronizedAt: null,
      },
      recentChanges: [],
      changeWindow: 'none',
    } as ReadinessResponse);

    const explanation = await service.getExplanation('household-1');
    const peace = explanation.pillars.find((pillar) => pillar.pillar === 'peace')!;

    expect(peace.factors[0]).toMatchObject({ capabilityId: 'derived-peace' });
    expect(peace.notEvaluated.map((factor) => factor.id)).not.toContain('derived-peace');
  });
});
