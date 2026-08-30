export const PACKAGE_NAME = '@wardkeep/readiness';

export { clampScore, computeOverallReadiness, computePeace, computePillarScore, DEFAULT_PILLAR_WEIGHTS } from './scoring';
export type { PillarAssessment, ReadinessAssessmentState } from './types';
export { READINESS_MODEL_VERSION, READINESS_PILLARS } from './types';
export { MODEL_2_PILLAR_BY_CAPABILITY, MODEL_2_PILLAR_WEIGHTS, reclassifySignalForModel2, reclassifySignalsForModel2 } from './model-2';
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
