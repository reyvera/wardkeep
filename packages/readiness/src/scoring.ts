import type {
  PillarScores,
  PillarWeights,
  ReadinessPillar,
  ReadinessSnapshot,
  Signal,
} from './types';

export const DEFAULT_PILLAR_WEIGHTS: Required<PillarWeights> = {
  protection: 0.25,
  provision: 0.30,
  preparation: 0.20,
  prosperity: 0.25,
};

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const MAGNITUDE_LIMIT = 10;

export function clampScore(value: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, value));
}

function clampMagnitude(value: number): number {
  return Math.max(-MAGNITUDE_LIMIT, Math.min(MAGNITUDE_LIMIT, value));
}

function usableWeight(weight: number | undefined): number {
  return weight !== undefined && Number.isFinite(weight) && weight > 0 ? weight : 1;
}

/**
 * Computes a pillar score from its signals. An absence of known risks receives no penalty.
 * Signal magnitudes are deliberately bounded so an erroneous generator cannot dominate a score.
 */
export function computePillarScore(
  pillar: Exclude<ReadinessPillar, 'peace'>,
  signals: readonly Signal[],
): number {
  const applicable = signals.filter((signal) => signal.pillar === pillar);
  if (applicable.length === 0) return SCORE_MAX;

  let weightedImpact = 0;
  let totalWeight = 0;
  for (const signal of applicable) {
    const weight = usableWeight(signal.weight);
    weightedImpact += clampMagnitude(signal.magnitude) * weight;
    totalWeight += weight;
  }

  return clampScore(SCORE_MAX + (weightedImpact / totalWeight) * 10);
}

/** Computes the weighted score for the four directly observed readiness pillars. */
export function computeOverallReadiness(
  pillarScores: Pick<PillarScores, Exclude<ReadinessPillar, 'peace'>>,
  weights: PillarWeights = DEFAULT_PILLAR_WEIGHTS,
): number {
  let total = 0;
  let totalWeight = 0;

  for (const pillar of Object.keys(DEFAULT_PILLAR_WEIGHTS) as Array<Exclude<ReadinessPillar, 'peace'>>) {
    const weight = weights[pillar] ?? DEFAULT_PILLAR_WEIGHTS[pillar];
    if (!Number.isFinite(weight) || weight <= 0) continue;
    total += clampScore(pillarScores[pillar]) * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? SCORE_MAX : Math.round(clampScore(total / totalWeight));
}

/**
 * Peace represents the household's least-secure dimension, moderated by recent score stability.
 * A volatile score is less reassuring even when the current point-in-time score looks healthy.
 */
export function computePeace(
  pillarScores: Pick<PillarScores, Exclude<ReadinessPillar, 'peace'>>,
  history: readonly ReadinessSnapshot[] = [],
): number {
  const lowestPillar = Math.min(...Object.values(pillarScores).map(clampScore));
  if (history.length < 2) return Math.round(lowestPillar);

  const recent = history.slice(-7);
  let totalChange = 0;
  for (let index = 1; index < recent.length; index++) {
    totalChange += Math.abs(recent[index]!.overall - recent[index - 1]!.overall);
  }
  const averageChange = totalChange / (recent.length - 1);
  return Math.round(clampScore(lowestPillar - Math.min(20, averageChange)));
}
