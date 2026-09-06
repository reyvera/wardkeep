import { BadRequestException } from '@nestjs/common';
import {
  ActivePillarScores,
  computePeace,
  computePillarScore,
  PillarAssessment,
  Signal,
} from '@wardkeep/readiness';

import type { ReadinessResponse } from './readiness.service';

const DIRECT_PILLARS = ['protection', 'provision', 'prosperity'] as const;
const CAPABILITY_TARGETS = { protection: 5, provision: 3, prosperity: 3 } as const;

export type ScenarioSignal = Pick<
  Signal,
  'capabilityId' | 'pillar' | 'type' | 'magnitude' | 'summary' | 'weight'
>;
export type ScenarioChange =
  | { operation: 'remove'; capabilityId: string }
  | { operation: 'replace'; capabilityId: string; signal: ScenarioSignal };

type ScenarioAssessment = Pick<
  ReadinessResponse,
  'overallAssessment' | 'pillarAssessments' | 'pillars' | 'coverage'
>;

function assessmentFor(
  signals: Signal[],
  pillars: ActivePillarScores,
): Pick<ScenarioAssessment, 'overallAssessment' | 'pillarAssessments' | 'coverage'> {
  const directAssessments = Object.fromEntries(
    DIRECT_PILLARS.map((pillar) => {
      const capabilities = [
        ...new Set(
          signals.filter((signal) => signal.pillar === pillar).map((signal) => signal.capabilityId),
        ),
      ];
      const coverage = Math.round(
        Math.min(1, capabilities.length / CAPABILITY_TARGETS[pillar]) * 100,
      );
      return [
        pillar,
        {
          state: capabilities.length === 0 ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
          score: capabilities.length === 0 ? null : pillars[pillar],
          coverage,
          evaluatedCapabilities: capabilities,
        } satisfies PillarAssessment,
      ];
    }),
  ) as Record<(typeof DIRECT_PILLARS)[number], PillarAssessment>;
  const coverage = Math.round(
    DIRECT_PILLARS.reduce((total, pillar) => total + directAssessments[pillar].coverage, 0) /
      DIRECT_PILLARS.length,
  );
  const evaluatedPillars = DIRECT_PILLARS.filter(
    (pillar) => directAssessments[pillar].score !== null,
  );
  const evaluatedWeight = evaluatedPillars.reduce(
    (total, pillar) =>
      total + ({ protection: 0.35, provision: 0.35, prosperity: 0.3 } as const)[pillar],
    0,
  );
  const overallScore =
    evaluatedWeight === 0
      ? null
      : Math.round(
          evaluatedPillars.reduce(
            (total, pillar) =>
              total +
              (directAssessments[pillar].score ?? 0) *
                ({ protection: 0.35, provision: 0.35, prosperity: 0.3 } as const)[pillar],
            0,
          ) / evaluatedWeight,
        );

  return {
    coverage,
    overallAssessment: {
      state: overallScore === null ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
      score: overallScore,
      coverage,
      evaluatedCapabilities: evaluatedPillars,
    },
    pillarAssessments: {
      ...directAssessments,
      peace: {
        state: coverage === 0 ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
        score: coverage === 0 ? null : pillars.peace,
        coverage,
        evaluatedCapabilities: evaluatedPillars,
      },
    },
  };
}

/** Applies explicit, in-memory factor changes without writing a household record or snapshot. */
export function evaluateReadinessScenario(
  current: ReadinessResponse,
  changes: ScenarioChange[],
): {
  current: ScenarioAssessment;
  scenario: ScenarioAssessment;
  changes: ScenarioChange[];
  limitations: string[];
} {
  const currentSignals: Signal[] = current.signals.map(
    ({ provenance: _provenance, ...signal }) => signal,
  );
  const knownCapabilities = new Set(currentSignals.map((signal) => signal.capabilityId));
  let scenarioSignals = [...currentSignals];

  for (const change of changes) {
    if (!knownCapabilities.has(change.capabilityId)) {
      throw new BadRequestException(
        `Scenario factor is not currently evaluated: ${change.capabilityId}`,
      );
    }
    scenarioSignals = scenarioSignals.filter(
      (signal) => signal.capabilityId !== change.capabilityId,
    );
    if (change.operation === 'replace') {
      if (change.signal.capabilityId !== change.capabilityId) {
        throw new BadRequestException('A scenario replacement must keep the same capability');
      }
      scenarioSignals.push(change.signal);
    }
  }

  const directScores = Object.fromEntries(
    DIRECT_PILLARS.map((pillar) => [pillar, computePillarScore(pillar, scenarioSignals)]),
  ) as Pick<ActivePillarScores, (typeof DIRECT_PILLARS)[number]>;
  const observedScores = Object.fromEntries(
    DIRECT_PILLARS.filter((pillar) =>
      scenarioSignals.some((signal) => signal.pillar === pillar),
    ).map((pillar) => [pillar, directScores[pillar]]),
  );
  const history = current.history.map((snapshot) => ({
    ...snapshot,
    pillars: { ...snapshot.pillars, preparation: 0 },
  }));
  const pillars: ActivePillarScores = {
    ...directScores,
    peace: computePeace(
      observedScores,
      history,
      scenarioSignals.filter((signal) => signal.pillar === 'peace'),
    ),
  };
  const scenarioAssessment = assessmentFor(scenarioSignals, pillars);

  return {
    current: {
      pillars: current.pillars,
      overallAssessment: current.overallAssessment,
      pillarAssessments: current.pillarAssessments,
      coverage: current.coverage,
    },
    scenario: { pillars, ...scenarioAssessment },
    changes,
    limitations: [
      'This comparison uses only the current recorded evidence and the explicit factor changes shown here.',
      'It is not a forecast, recommendation, or estimate of an unrecorded life, market, insurance, or institutional outcome.',
      'The scenario is not saved and does not change household records, readiness history, or recommendations.',
    ],
  };
}
