export const READINESS_PILLARS = [
  'protection',
  'provision',
  'preparation',
  'prosperity',
  'peace',
] as const;

export type ReadinessPillar = (typeof READINESS_PILLARS)[number];
export type SignalType = 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';

/** A traceable, scored interpretation of a household observation. */
export interface Signal {
  id?: string;
  capabilityId: string;
  type: SignalType;
  /** Impact from -10 (strong risk) to +10 (strong positive). */
  magnitude: number;
  pillar: Exclude<ReadinessPillar, 'peace'>;
  summary: string;
  observationId?: string;
  weight?: number;
  expiresAt?: Date;
  /** Recorded financial context for a recommendation; absent when Wardkeep cannot estimate it. */
  financialImpact?: {
    amount?: string;
    monthlyAmount?: string;
    label?: string;
    timeToCompletionDays?: number;
  };
}

/** A fact collected by a capability before it is interpreted as a signal. */
export interface Observation {
  capabilityId: string;
  fact: string;
  value: unknown;
  observedAt: Date;
  confidence: number;
}

export interface Recommendation {
  capabilityId: string;
  action: string;
  reasoning: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'trivial' | 'small' | 'medium' | 'large';
  impactEstimate: string;
  deadline?: Date;
}

export type PillarScores = Record<ReadinessPillar, number>;

/** Describes whether a score is based on a sufficiently complete observation set. */
export type ReadinessAssessmentState = 'known' | 'partial' | 'not_evaluated';

/** A score and the evidence-quality state required to interpret it honestly. */
export interface PillarAssessment {
  state: ReadinessAssessmentState;
  /** Null when Wardkeep has not evaluated this pillar. */
  score: number | null;
  coverage: number;
  evaluatedCapabilities: string[];
}

export interface ReadinessSnapshot {
  overall: number;
  pillars: PillarScores;
  recordedAt: Date;
}

export type PillarWeights = Partial<Record<Exclude<ReadinessPillar, 'peace'>, number>>;
