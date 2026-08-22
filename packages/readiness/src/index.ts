export const PACKAGE_NAME = '@wardkeep/readiness';

export { clampScore, computeOverallReadiness, computePeace, computePillarScore, DEFAULT_PILLAR_WEIGHTS } from './scoring';
export type { PillarAssessment, ReadinessAssessmentState } from './types';
export { READINESS_PILLARS } from './types';
export type {
  Observation,
  PillarScores,
  PillarWeights,
  ReadinessPillar,
  ReadinessSnapshot,
  Recommendation,
  Signal,
  SignalType,
} from './types';
