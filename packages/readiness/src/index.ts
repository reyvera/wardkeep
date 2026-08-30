export const PACKAGE_NAME = '@wardkeep/readiness';

export { clampScore, computeOverallReadiness, computePeace, computePillarScore, DEFAULT_PILLAR_WEIGHTS } from './scoring';
export type { PillarAssessment, ReadinessAssessmentState } from './types';
export { READINESS_MODEL_VERSION, READINESS_PILLARS } from './types';
export {
  MODEL_2_DIRECT_PILLARS,
  MODEL_2_PILLAR_BY_CAPABILITY,
  MODEL_2_PILLAR_WEIGHTS,
  MODEL_2_VERSION,
  reclassifySignalForModel2,
  reclassifySignalsForModel2,
  computeModel2Overall,
} from './model-2';
export type { Model2DirectPillar, Model2Pillar } from './model-2';
export type {
  Observation,
  ActivePillarScores,
  LegacyPillarScores,
  PillarScores,
  PillarWeights,
  ReadinessPillar,
  ReadinessSnapshot,
  Recommendation,
  Signal,
  SignalType,
} from './types';
