# Capability Architecture

## Core Concept

A **Capability** is a self-contained domain of household knowledge that contributes to the Readiness Engine. Every Capability follows the same contract: it observes, signals, recommends, and surfaces relevant information through a unified pipeline.

Capabilities are not "modules" or "plugins" — those words imply optional add-ons. Capabilities are how Wardkeep understands a household.

## The Pipeline

Every Capability contributes to a single intelligence pipeline:

```
Capability
  ↓
Observations    (raw facts about the household)
  ↓
Signals         (interpreted meaning: risk, opportunity, milestone)
  ↓
Readiness Engine (aggregates signals into household readiness)
  ↓
Insights        (human-readable explanations and recommendations)
  ↓
Advisor         (prioritized, contextual guidance)
  ↓
User            (decisions and actions)
```

No Capability bypasses this pipeline. This is what keeps the product coherent as it grows.

## Capability Interface

Every Capability implements a common contract:

```typescript
interface Capability {
  /** Unique identifier and display metadata */
  metadata: CapabilityMetadata;

  /**
   * Raw facts this Capability knows about the household.
   * Observations are objective, timestamped, and verifiable.
   * Examples: "Mortgage balance is $182,400", "Oil change due at 45,000 miles"
   */
  observations(): Observation[];

  /**
   * Interpreted signals derived from observations.
   * Signals carry meaning: risk level, opportunity, milestone reached.
   * Examples: Risk +4 (water heater age), Opportunity +3 (refinance rate drop)
   */
  signals(): Signal[];

  /**
   * Actionable recommendations based on current signals.
   * Each recommendation has a priority, effort estimate, and expected impact.
   */
  recommendations(): Recommendation[];

  /**
   * Cards to display on the household dashboard.
   * Should answer one question at a glance.
   */
  dashboardCards(): DashboardCard[];

  /**
   * Events to place on the Household Timeline.
   * Past events (what happened), future events (what's coming).
   */
  timelineEvents(): TimelineEvent[];
}
```

## Capability Metadata

```typescript
interface CapabilityMetadata {
  /** Unique slug: 'finance', 'vehicle', 'insurance', 'garden' */
  id: string;

  /** Human-readable name */
  name: string;

  /** Which readiness pillar(s) this contributes to */
  pillars: ReadinessPillar[];

  /** Icon identifier for UI rendering */
  icon: string;

  /** Brief description of what this Capability covers */
  description: string;

  /** Whether this is a core Capability or community-contributed */
  source: 'core' | 'community' | 'marketplace';
}
```

## Core Types

### Observations

```typescript
interface Observation {
  /** Which Capability produced this */
  capabilityId: string;

  /** What was observed */
  fact: string;

  /** Machine-readable value for computation */
  value: unknown;

  /** When this was last confirmed/updated */
  observedAt: Date;

  /** Confidence level (1.0 = verified fact, 0.5 = estimated) */
  confidence: number;
}
```

### Signals

```typescript
interface Signal {
  capabilityId: string;

  /** What this signal means */
  type: 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';

  /** Magnitude (-10 to +10, where negative = risk, positive = opportunity) */
  magnitude: number;

  /** Which pillar this affects */
  pillar: ReadinessPillar;

  /** Human-readable explanation */
  summary: string;

  /** When this signal expires or should be re-evaluated */
  expiresAt?: Date;
}
```

### Recommendations

```typescript
interface Recommendation {
  capabilityId: string;

  /** What the user should do */
  action: string;

  /** Why this matters */
  reasoning: string;

  /** Priority relative to other recommendations */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Estimated effort to complete */
  effort: 'trivial' | 'small' | 'medium' | 'large';

  /** Expected impact on readiness */
  impactEstimate: string;

  /** When this should ideally be done by */
  deadline?: Date;
}
```

### Dashboard Cards

```typescript
interface DashboardCard {
  capabilityId: string;

  /** The question this card answers */
  question: string;

  /** The answer (brief, human-readable) */
  answer: string;

  /** Visual status indicator */
  status: 'excellent' | 'good' | 'attention' | 'warning' | 'critical';

  /** Optional numeric value to display */
  metric?: { value: string; label: string };
}
```

### Timeline Events

```typescript
interface TimelineEvent {
  capabilityId: string;

  /** What happened or will happen */
  title: string;

  /** Additional context */
  description?: string;

  /** When */
  date: Date;

  /** Past or future */
  temporal: 'past' | 'upcoming' | 'recurring';

  /** Whether this requires action */
  actionRequired: boolean;
}
```

## Readiness Pillars

Every signal maps to one of five pillars. These form the top-level structure of household readiness:

```typescript
type ReadinessPillar =
  | 'protection'   // Insurance, emergency fund, security, estate
  | 'provision'    // Cash flow, income, bills, budget
  | 'preparation'  // Maintenance, taxes, goals, planning
  | 'prosperity'   // Investments, debt reduction, net worth, giving
  | 'peace';       // Overall stability indicator, family wellbeing
```

| Pillar | Covers | Example Capabilities |
|--------|--------|---------------------|
| Protection | Insurance, emergency fund, passwords, estate, security | Insurance, Estate, Emergency Fund |
| Provision | Cash flow, bills, income, budget, spending | Finance (core), Bank Sync |
| Preparation | Maintenance, taxes, goals, education, inventory | Vehicle, Home, Garden, Homeschool |
| Prosperity | Investments, debt payoff, net worth, giving | Investments, Debt Strategy, Giving |
| Peace | Overall household stability, family communication | Derived from all other pillars |

## Phase 1 Capabilities (Core Finance)

These ship as part of the core platform:

| Capability | Description |
|-----------|-------------|
| `accounts` | Bank accounts, balances, net worth |
| `transactions` | Income and spending tracking |
| `budgets` | Spending plans and adherence |
| `debt` | Loans, payoff strategies, interest optimization |
| `cashflow` | Forward-looking income vs. expenses |
| `recurring` | Bills, subscriptions, predictable expenses |
| `goals` | Savings targets and progress |
| `emergency-fund` | Emergency preparedness tracking |

## Future Capabilities (Phase 3+)

These extend the platform beyond finance:

| Capability | Pillar | Description |
|-----------|--------|-------------|
| `vehicle` | Preparation | Maintenance schedules, fuel, registration |
| `insurance` | Protection | Policies, renewals, coverage gaps |
| `home` | Preparation | Maintenance, repairs, appliance lifecycles |
| `garden` | Preparation | Seasonal tasks, supplies, harvests |
| `estate` | Protection | Wills, beneficiaries, document locations |
| `medical` | Protection | HSA, prescriptions, appointments |
| `education` | Preparation | Curriculum, supplies, schedules |
| `inventory` | Preparation | Household items, warranties, valuations |

## Registration and Discovery

Capabilities register themselves with the platform at startup:

```typescript
interface CapabilityRegistry {
  /** Register a new Capability */
  register(capability: Capability): void;

  /** Get all active Capabilities */
  all(): Capability[];

  /** Get Capabilities contributing to a specific pillar */
  byPillar(pillar: ReadinessPillar): Capability[];

  /** Get a specific Capability by ID */
  get(id: string): Capability | undefined;
}
```

The registry is the single integration point. A Capability doesn't need to know about other Capabilities — it only needs to produce observations, signals, recommendations, cards, and timeline events. The Readiness Engine and Advisor handle cross-capability reasoning.

## Cross-Capability Reasoning

The Advisor (AI layer) has access to signals from all Capabilities simultaneously. This enables insights that no single Capability could produce alone:

- "Your car insurance renewal is next month. Based on your emergency fund level, you could safely increase your deductible to save $240/year."
- "Your mortgage payment increases in March (ARM adjustment). Combined with your planned vacation in April, you may want to build an extra $800 buffer."

This cross-capability reasoning is what makes Wardkeep a decision engine rather than a collection of trackers.
