# Technical Architecture

## How the Vision Maps to Code

This document bridges the product philosophy and the repository structure. Wardkeep is evolving from a self-hosted finance foundation into a household-readiness command center: finance produces evidence, deterministic services derive explainable signals, and the product guides the next useful household action.

## Current Repository → Future Structure

### Today

```
apps/
  api/          → NestJS REST API
  web/          → Next.js PWA
  worker/       → BullMQ consumer

packages/
  shared/       → Types, validation, constants
  finance-engine/ → Pure deterministic math
  ai-engine/    → AI provider abstraction
  importers/    → File parsers (CSV, OFX, QFX)
```

### Current direction

```
apps/
  api/          → NestJS REST API (orchestrates Capabilities)
  web/          → Next.js PWA (renders Readiness, Brief, Timeline)
  worker/       → BullMQ consumer (background signal computation)

packages/
  shared/         → Types, validation, constants
  readiness/      → Readiness Engine (deterministic score computation) [implemented]
  advisor/        → AI layer (explains, prioritizes, cross-references) [planned]
  capability-sdk/ → Base interfaces and registry for Capabilities

capabilities/
  finance/        → Core finance (accounts, transactions, budgets, debt, cashflow)
  vehicle/        → Vehicle maintenance and costs
  insurance/      → Policies, renewals, coverage
  home/           → Home maintenance and appliance lifecycle
  estate/         → Wills, beneficiaries, documents
  ...
```

### Migration Path

The transition is incremental, not a rewrite:

1. **Finance foundation (shipped):** Accounts, transactions, budgets, debt, cash flow, recurring detection, import, bank sync, and deterministic math provide the first household observations.

2. **Readiness foundation (shipped):** `packages/readiness`, finance signal generators, daily snapshots, the readiness API, coverage indicators, a graduated liquidity-resilience signal, and a readiness-focused dashboard are in place.

3. **Decision engine (next):** Harden coverage and data freshness, persist explanations and recommendation state, add a timeline/change feed, and expose scenarios and impact previews.

4. **Household platform (future):** Extract the Capability SDK and add insurance, estate, home, vehicle, medical, and other independently observable household domains.

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer (apps/web)                          │
│  Dashboard • Financial Overview • Readiness • Timeline • Advisor │
├─────────────────────────────────────────────────────────┤
│  API Layer (apps/api)                                   │
│  REST endpoints • Auth • Rate limiting • Orchestration  │
├─────────────────────────────────────────────────────────┤
│  Intelligence Layer                                     │
│  Readiness Engine (deterministic) • Advisor (AI)        │
├─────────────────────────────────────────────────────────┤
│  Capability Layer                                       │
│  Finance • Vehicle • Insurance • Home • Estate • ...    │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  PostgreSQL • Redis • Encrypted at-rest                 │
├─────────────────────────────────────────────────────────┤
│  Background Layer (apps/worker)                         │
│  Snapshotting • signal computation • AI categorization • sync • backup │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Readiness Engine is Deterministic

The Readiness Engine lives in `packages/readiness`. It is:
- Pure functions (no I/O, no side effects)
- Fully testable with property-based tests
- Independent of AI — computes scores from signals alone
- Uses Decimal.js for any financial calculations that feed into scores

It also has an explicit honesty contract: an unevaluated pillar is not healthy. The API and UI expose readiness coverage separately from the score. See [readiness-engine.md](readiness-engine.md) for the current scoring behavior and limitations.

The AI layer (Advisor) only explains and prioritizes. It never modifies scores.

### 2. Capabilities are Self-Contained

Each Capability:
- Owns its data models (Prisma schema extensions or separate tables)
- Owns its API routes (NestJS module)
- Owns its signal generation logic
- Registers itself with the CapabilityRegistry at startup
- Can be enabled/disabled per household

### 3. Signal pipeline: current and target

```
Current:
User request or dashboard load
  → finance generators derive current signals
  → Readiness Engine computes pillars and coverage
  → API records a daily snapshot asynchronously
  → frontend renders the score, factors, coverage, and history

Target:
User action or scheduled job
  → Capability recalculates observations
  → Capability emits versioned signals and score-change reasons
  → worker recomputes affected pillars and snapshots
  → recommendation/timeline services prioritize relevant changes
  → frontend receives a concise command-center update
```

### 4. The Advisor is Stateless Per-Request

The Advisor:
- Receives the current readiness state, signals, and user context
- Generates briefs, explanations, and recommendations
- Does not maintain conversation state beyond the current session
- Falls back gracefully if AI is unavailable (readiness still works)

### 5. Data Isolation

Every query includes `householdId`. There is no way to access another household's data at the service layer. This is enforced by:
- NestJS guards that inject householdId from the authenticated session
- Repository-level WHERE clauses (never optional)
- Database-level RLS (Row Level Security) as a secondary guard in production

## Implemented finance-readiness foundation

The current codebase already implements the finance Capability. Here's how existing code maps to the Capability interface:

| Capability Method | Current Implementation |
|-------------------|----------------------|
| `observations()` | AccountsService.findAll(), TransactionsService.findAll() |
| `signals()` | Implemented generators for budget pace, cash flow, bill coverage, net worth, debt, and liquid reserves |
| `recommendations()` | Dashboard presents signal-derived next steps; durable prioritized recommendations are next |
| `dashboardCards()` | Implemented household readiness hero and explainable pillar cards; Financial Overview retains raw financial detail |
| `timelineEvents()` | RecurringService (bills), projected payments, goal milestones |

### Next implementation priorities

1. **Reliable data and coverage** — Model freshness, provenance, and known/partial/unknown explicitly. Keep scores and coverage coherent when accounts are manual, synchronized, estimated, or stale.
2. **Composite Protection** — Add data models and generators for insurance, estate, income interruption, fixed obligations, dependents, and secondary backstops. Maintain independent, explainable signals.
3. **Recommendation and explanation services** — Persist score-change reasons and rank actions by severity, urgency, financial impact, actionability, and confidence.
4. **Household Timeline and change feed** — Aggregate bills, renewals, maintenance, taxes, sinking-fund targets, and replacement windows into “Coming up” and “Since your last visit.”
5. **Scenarios and planning** — Model deterministic what-ifs, show impact previews, and connect recommendations to plans and measured outcomes.

## API Design

### Readiness Endpoints

```
GET  /api/readiness              → Overall score + pillar breakdown
GET  /api/readiness/history      → Score snapshots over time
GET  /api/readiness/explain      → Full explanation with contributing signals
GET  /api/readiness/scenario     → "What if" score computation (Phase 2+)
```

### Advisor Endpoints

```
GET  /api/advisor/brief/morning  → Today's brief
GET  /api/advisor/brief/weekly   → Weekly summary
POST /api/advisor/query          → Ask the advisor a question
GET  /api/advisor/recommendations → Prioritized action list
```

### Timeline Endpoints

```
GET  /api/timeline               → Unified household timeline
GET  /api/timeline/upcoming      → Next 30 days of events
GET  /api/timeline/history       → Past events (audit trail)
```

### Capability Endpoints

```
GET  /api/capabilities           → List active Capabilities
POST /api/capabilities/:id/enable  → Enable a Capability for this household
POST /api/capabilities/:id/disable → Disable a Capability
GET  /api/capabilities/:id/signals → Signals from a specific Capability
```

## Database Schema Additions

```prisma
model ReadinessSnapshot {
  id          String   @id @default(uuid())
  householdId String
  date        DateTime @default(now())
  overall     Int
  protection  Int
  provision   Int
  preparation Int
  prosperity  Int
  peace       Int
  signalCount Int
  createdAt   DateTime @default(now())

  @@index([householdId, date])
  @@map("readiness_snapshots")
}

model Signal {
  id           String   @id @default(uuid())
  householdId  String
  capabilityId String
  type         String   // risk, opportunity, milestone, warning, positive
  magnitude    Int      // -10 to +10
  pillar       String   // protection, provision, preparation, prosperity, peace
  summary      String
  expiresAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([householdId, pillar])
  @@index([householdId, capabilityId])
  @@map("signals")
}

model Recommendation {
  id           String   @id @default(uuid())
  householdId  String
  capabilityId String
  action       String
  reasoning    String
  priority     String   // critical, high, medium, low
  effort       String   // trivial, small, medium, large
  impact       String
  deadline     DateTime?
  dismissed    Boolean  @default(false)
  completedAt  DateTime?
  createdAt    DateTime @default(now())

  @@index([householdId, priority])
  @@map("recommendations")
}

model TimelineEvent {
  id           String   @id @default(uuid())
  householdId  String
  capabilityId String
  title        String
  description  String?
  date         DateTime
  temporal     String   // past, upcoming, recurring
  actionRequired Boolean @default(false)
  completedAt  DateTime?
  createdAt    DateTime @default(now())

  @@index([householdId, date])
  @@map("timeline_events")
}
```

## Technology Choices (Unchanged)

The existing technology stack supports this architecture without changes:

| Layer | Technology | Why It Still Works |
|-------|-----------|-------------------|
| API | NestJS | Module system maps perfectly to Capabilities |
| Frontend | Next.js | App Router for Readiness pages, Server Components for Brief |
| Background | BullMQ + Redis | Signal recomputation jobs, AI processing |
| Database | PostgreSQL | JSONB for flexible Capability data, strong indexing |
| Math | Decimal.js | Required for financial accuracy in Readiness |
| AI | Ollama / OpenAI / Anthropic | Advisor provider abstraction already exists |
| Monorepo | Turborepo + pnpm | Package isolation for readiness, advisor, capability-sdk |

## Security Considerations

- Signals and Readiness scores contain sensitive derived information. Same encryption and access control as financial data.
- The Advisor receives aggregated signals, not raw transaction data, when possible (especially in HYBRID mode).
- Capability data isolation: each Capability's data is scoped to householdId. A Capability cannot access another Capability's raw data — only its published signals (through the Readiness Engine).
- Timeline events are filtered by household. No cross-household data leakage through the Timeline API.

## What NOT to Build Yet

- Multi-Capability marketplace (Phase 4)
- Cloud hosting infrastructure (Phase 5)
- Enterprise features: LDAP, SAML, teams (Phase 6)
- Scenario modeling UI (Phase 2+)
- Custom Capability SDK for third-party developers (Phase 4)
- White-label theming (Phase 5+)

Stay focused on Phase 1: best self-hosted finance platform with the Readiness Engine as the differentiator. Everything else is informed by these documents but not built until its phase arrives.
