import { describe, expect, it } from 'vitest';

import { formatReadinessContext } from './ai-chat.service';

describe('formatReadinessContext', () => {
  it('includes observed readiness evidence without treating unevaluated pillars as scores', () => {
    const context = formatReadinessContext({
      overallAssessment: { score: 62, state: 'partial', coverage: 55, evaluatedCapabilities: [] },
      pillarAssessments: {
        protection: { score: 50, state: 'partial', coverage: 50, evaluatedCapabilities: [] },
        provision: { score: null, state: 'not_evaluated', coverage: 0, evaluatedCapabilities: [] },
        preparation: { score: null, state: 'not_evaluated', coverage: 0, evaluatedCapabilities: [] },
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
