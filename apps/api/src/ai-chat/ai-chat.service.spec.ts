import { describe, expect, it } from 'vitest';

import { deterministicAdvisorFallback, formatReadinessContext } from './ai-chat.service';

describe('formatReadinessContext', () => {
  it('includes observed readiness evidence without treating unevaluated pillars as scores', () => {
    const context = formatReadinessContext({
      overallAssessment: { score: 62, state: 'partial', coverage: 55, evaluatedCapabilities: [] },
      pillarAssessments: {
        protection: { score: 50, state: 'partial', coverage: 50, evaluatedCapabilities: [] },
        provision: { score: null, state: 'not_evaluated', coverage: 0, evaluatedCapabilities: [] },
        preparation: {
          score: null,
          state: 'not_evaluated',
          coverage: 0,
          evaluatedCapabilities: [],
        },
        prosperity: { score: 74, state: 'known', coverage: 100, evaluatedCapabilities: [] },
        peace: { score: 48, state: 'partial', coverage: 50, evaluatedCapabilities: [] },
      },
      topRisks: [{ summary: 'Liquid reserves are limited.' }],
    } as never);

    expect(context).toContain('62% (partial, 55% coverage)');
    expect(context).toContain('protection: 50% (partial)');
    expect(context).not.toContain('provision:');
    expect(context).toContain('Liquid reserves are limited.');
  });
});

describe('deterministicAdvisorFallback', () => {
  it('explains a recorded readiness change without inventing a cause when AI is unavailable', () => {
    const message = deterministicAdvisorFallback({
      overallAssessment: { score: 62, state: 'partial', coverage: 55, evaluatedCapabilities: [] },
      recentChanges: [
        {
          pillar: 'protection',
          previous: 58,
          current: 62,
          delta: 4,
          comparedTo: new Date('2026-08-23T00:00:00.000Z'),
          reason: 'Liquid reserves increased after a recorded account update.',
        },
      ],
      trendWindows: [],
      topRisks: [{ summary: 'Upcoming policy renewal needs review.' }],
    } as never);

    expect(message).toContain('current readiness assessment is 62% with 55% coverage');
    expect(message).toContain('protection pillar is up 4 points');
    expect(message).toContain('newly observed factor is: Liquid reserves increased');
    expect(message).toContain('Current attention: Upcoming policy renewal needs review.');
  });
});
