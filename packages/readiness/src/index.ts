export const PACKAGE_NAME = '@wardkeep/readiness';

export { clampScore, computeOverallReadiness, computePeace, computePillarScore, DEFAULT_PILLAR_WEIGHTS } from './scoring';
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
