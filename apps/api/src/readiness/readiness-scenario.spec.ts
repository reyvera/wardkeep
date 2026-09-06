import { describe, expect, it } from 'vitest';

import { ReadinessResponse } from './readiness.service';
import { evaluateReadinessScenario } from './readiness-scenario';

const current = {
  pillars: { protection: 50, provision: 100, prosperity: 100, peace: 50 },
  signals: [
    {
      capabilityId: 'emergency-fund',
      pillar: 'protection',
      type: 'risk',
      magnitude: -5,
      summary: 'Reserve is low.',
    },
    {
      capabilityId: 'budgets',
      pillar: 'provision',
      type: 'positive',
      magnitude: 1,
      summary: 'Budget is recorded.',
    },
    {
      capabilityId: 'net-worth',
      pillar: 'prosperity',
      type: 'positive',
      magnitude: 1,
      summary: 'Net worth is recorded.',
    },
  ],
  history: [],
  overallAssessment: {
    state: 'partial',
    score: 83,
    coverage: 50,
    evaluatedCapabilities: ['protection', 'provision', 'prosperity'],
  },
  pillarAssessments: {
    protection: {
      state: 'partial',
      score: 50,
      coverage: 20,
      evaluatedCapabilities: ['emergency-fund'],
    },
    provision: { state: 'partial', score: 100, coverage: 33, evaluatedCapabilities: ['budgets'] },
    prosperity: {
      state: 'partial',
      score: 100,
      coverage: 33,
      evaluatedCapabilities: ['net-worth'],
    },
    peace: {
      state: 'partial',
      score: 50,
      coverage: 29,
      evaluatedCapabilities: ['protection', 'provision', 'prosperity'],
    },
  },
  coverage: 29,
} as unknown as ReadinessResponse;

describe('deterministic readiness scenarios', () => {
  it('recomputes the affected direct pillar, overall assessment, and derived Peace in memory', () => {
    const result = evaluateReadinessScenario(current, [
      {
        operation: 'replace',
        capabilityId: 'emergency-fund',
        signal: {
          capabilityId: 'emergency-fund',
          pillar: 'protection',
          type: 'positive',
          magnitude: 1,
          summary: 'Hypothetical reserve change entered by the household.',
        },
      },
    ]);

    expect(result.current.pillars.protection).toBe(50);
    expect(result.scenario.pillars).toMatchObject({
      protection: 100,
      provision: 100,
      prosperity: 100,
      peace: 100,
    });
    expect(result.scenario.overallAssessment.score).toBe(100);
    expect(result.limitations).toContain(
      'The scenario is not saved and does not change household records, readiness history, or recommendations.',
    );
  });

  it('does not let a scenario invent a capability that current evidence has not evaluated', () => {
    expect(() =>
      evaluateReadinessScenario(current, [
        { operation: 'remove', capabilityId: 'unrecorded-insurance' },
      ]),
    ).toThrow('Scenario factor is not currently evaluated');
  });

  it('does not let a replacement change the identity of the factor it models', () => {
    expect(() =>
      evaluateReadinessScenario(current, [
        {
          operation: 'replace',
          capabilityId: 'emergency-fund',
          signal: {
            capabilityId: 'insurance',
            pillar: 'protection',
            type: 'positive',
            magnitude: 1,
            summary: 'Mismatched capability.',
          },
        },
      ]),
    ).toThrow('A scenario replacement must keep the same capability');
  });
});
