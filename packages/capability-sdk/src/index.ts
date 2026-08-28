/** The five dimensions Wardkeep uses to describe household readiness. */
export type ReadinessPillar =
  | 'protection'
  | 'provision'
  | 'preparation'
  | 'prosperity'
  | 'peace';

export type SignalType = 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * The only household identity a capability receives when it evaluates data.
 * Capability implementations must use this scope for every data-provider call
 * and must publish signals instead of exposing raw records to other capabilities.
 */
export interface CapabilityContext {
  householdId: string;
  evaluatedAt: Date;
}

/** A timestamped, objective fact recorded by a capability. */
export interface Observation {
  capabilityId: string;
  fact: string;
  value: unknown;
  observedAt: Date;
  confidence: number;
}

/** An interpretation of an observation that can affect readiness. */
export interface Signal {
  capabilityId: string;
  type: SignalType;
  magnitude: number;
  pillar: ReadinessPillar;
  summary: string;
  expiresAt?: Date;
}

/** A transparent, actionable next step derived from capability signals. */
export interface Recommendation {
  capabilityId: string;
  action: string;
  reasoning: string;
  priority: RecommendationPriority;
  effort: 'trivial' | 'small' | 'medium' | 'large';
  impactEstimate: string;
  deadline?: Date;
}

/** A concise answer to one household question for the dashboard. */
export interface DashboardCard {
  capabilityId: string;
  question: string;
  answer: string;
  status: 'excellent' | 'good' | 'attention' | 'warning' | 'critical';
  metric?: { value: string; label: string };
}

/** A dated record or upcoming action contributed to the household timeline. */
export interface TimelineEvent {
  capabilityId: string;
  title: string;
  description?: string;
  date: Date;
  temporal: 'past' | 'upcoming' | 'recurring';
  actionRequired: boolean;
}

/** Stable identity and presentation information for a capability. */
export interface CapabilityMetadata {
  id: string;
  name: string;
  pillars: ReadinessPillar[];
  icon: string;
  description: string;
  source: 'core' | 'community' | 'marketplace';
}

/**
 * The common contract for a self-contained domain of household knowledge.
 * Implementations publish facts and interpretations but do not own readiness aggregation.
 */
export interface Capability {
  metadata: CapabilityMetadata;
  observations(context: CapabilityContext): Observation[] | Promise<Observation[]>;
  signals(context: CapabilityContext): Signal[] | Promise<Signal[]>;
  recommendations(context: CapabilityContext): Recommendation[] | Promise<Recommendation[]>;
  dashboardCards(context: CapabilityContext): DashboardCard[] | Promise<DashboardCard[]>;
  timelineEvents(context: CapabilityContext): TimelineEvent[] | Promise<TimelineEvent[]>;
}

/** The single discovery point for capabilities active in the application. */
export interface CapabilityRegistry {
  register(capability: Capability): void;
  all(): Capability[];
  byPillar(pillar: ReadinessPillar): Capability[];
  get(id: string): Capability | undefined;
}
