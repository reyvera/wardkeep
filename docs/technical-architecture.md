# Technical Architecture

## How the Vision Maps to Code

This document bridges the product philosophy and the existing repository structure. It defines how the Household Intelligence Platform architecture maps onto the current monorepo while keeping Phase 1 focused on becoming the best self-hosted finance platform.

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

### Target (Phase 3+)

```
apps/
  api/          → NestJS REST API (orchestrates Capabilities)
  web/          → Next.js PWA (renders Readiness, Brief, Timeline)
  worker/       → BullMQ consumer (background signal computation)

packages/
  shared/         → Types, validation, constants
  readiness/      → Readiness Engine (deterministic score computation)
  advisor/        → AI layer (explains, prioritizes, cross-references)
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

1. **Phase 1 (now):** Keep the current structure. The finance-engine, accounts, transactions, budgets — all of this becomes the `finance` Capability internally. No code needs to move yet.

2. **Phase 2 (AI):** Evolve `ai-engine` into `advisor`. Add Morning Brief, Weekly Brief generation. The Advisor consumes data from existing services.

3. **Phase 3 (Platform):** Extract the Capability interface. Refactor existing finance services to implement it. Create `packages/readiness` for the engine. New Capabilities (vehicle, insurance, etc.) use the SDK from day one.

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer (apps/web)                          │
│  Morning Brief • Readiness View • Timeline • Advisor UI │
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
│  Signal computation • AI categorization • Sync • Backup │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Readiness Engine is Deterministic

The Readiness Engine lives in `packages/readiness`. It is:
- Pure functions (no I/O, no side effects)
- Fully testable with property-based tests
- Independent of AI — computes scores from signals alone
- Uses Decimal.js for any financial calculations that feed into scores

The AI layer (Advisor) only explains and prioritizes. It never modifies scores.

### 2. Capabilities are Self-Contained

Each Capability:
- Owns its data models (Prisma schema extensions or separate tables)
- Owns its API routes (NestJS module)
- Owns its signal generation logic
- Registers itself with the CapabilityRegistry at startup
- Can be enabled/disabled per household

### 3. Signal Pipeline is Event-Driven

```
User action or scheduled job
  → Capability recalculates observations
  → Capability emits signals to Redis stream
  → Worker picks up signal events
  → Readiness Engine recomputes affected pillar scores
  → Updated scores stored in PostgreSQL
  → If significant change: Advisor generates insight
  → Frontend receives update via polling or WebSocket
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

## Phase 1 Implementation: Finance Capability

The current codebase already implements the finance Capability. Here's how existing code maps to the Capability interface:

| Capability Method | Current Implementation |
|-------------------|----------------------|
| `observations()` | AccountsService.findAll(), TransactionsService.findAll() |
| `signals()` | To be added — derives from budget adherence, debt ratios, cashflow projections |
| `recommendations()` | To be added — "pay extra on highest-interest debt", "increase emergency fund" |
| `dashboardCards()` | Currently: raw account list. Target: "Provision: Good", "Net Worth: $X" |
| `timelineEvents()` | RecurringService (bills), projected payments, goal milestones |

### What to Build Now (Phase 1 Additions)

1. **Signal generation for finance** — Convert existing finance-engine outputs (budget overspend, debt-to-income ratio, emergency fund months, cashflow forecast) into typed Signals.

2. **Readiness computation** — Implement the scoring logic in `packages/readiness`. Initially only the Provision and Prosperity pillars have data.

3. **Morning Brief endpoint** — API route that returns today's priorities, upcoming events, and top recommendation. Initially powered by deterministic logic, later enhanced by AI.

4. **Household Timeline endpoint** — Aggregate recurring bills, goal milestones, and projected events into a single chronological feed.

5. **Readiness dashboard** — Frontend component that shows overall score, pillar breakdown, and trend chart.

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
