# Implementation Plan: Wardkeep — Household Intelligence Platform

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Phase 1 — Finance Platform",
      "tasks": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18"
      ],
      "status": "complete"
    },
    {
      "name": "Phase 2 — Decision Engine",
      "tasks": ["19", "20", "21", "22", "23", "24", "25"],
      "dependsOn": ["Phase 1 — Finance Platform"],
      "status": "in_progress"
    },
    {
      "name": "Ongoing Enhancements",
      "tasks": ["33", "34", "35", "36", "37", "38", "39"],
      "dependsOn": ["Phase 1 — Finance Platform"]
    }
  ]
}
```

## Tasks

## Overview

Wardkeep is a decision engine for households. It answers the questions people lose sleep over: Am I okay? Can I afford this? What's my biggest risk? What should I do today?

The platform is built in phases. Finance is the entry point — not the destination. Every Capability contributes observations, signals, and recommendations through a unified pipeline into the Readiness Engine, which produces an explainable household readiness score. The Advisor (AI layer) explains, prioritizes, and surfaces what matters. The Finance Engine (deterministic math) remains the source of truth for all calculations.

See `/docs/philosophy.md` for principles. See `/docs/capability-architecture.md` for the pipeline. See `/docs/readiness-engine.md` for scoring. See `/docs/terminology.md` for language. See `/docs/technical-architecture.md` for how it maps to code.

---

## Phase 1 — Best Self-Hosted Finance Platform [COMPLETE]

> Goal: Build a fully functional, self-hosted personal finance app that beats Firefly III and Actual Budget on capability and UX.

### 1. Monorepo Foundation [COMPLETE]

- [x] 1.1 Initialize Turborepo monorepo with workspace configuration
- [x] 1.2 Define shared types and validation schemas in packages/shared
- [x] 1.3 Set up Prisma schema and database migrations
- [x] 1.4 Write property test for password validation (Property 33)

### 2. Authentication & Sessions [COMPLETE]

- [x] 2.1 Scaffold NestJS API application with core module structure
- [x] 2.2 Implement AuthModule with registration, login, and session management
- [x] 2.3 Implement account lockout and password reset flow
- [x] 2.4 Implement rate limiting and per-user data isolation
- [x] 2.5 Write property test for rate limiting (Property 31)
- [x] 2.6 Write property test for data isolation (Property 30)

### 3. Finance Engine [COMPLETE]

- [x] 3.1 Implement account balance and net worth calculations
- [x] 3.2 Write property tests for balance and net worth (Properties 1, 2, 3)
- [x] 3.3 Implement budget calculation functions
- [x] 3.4 Write property tests for budget calculations (Properties 9, 10)
- [x] 3.5 Implement debt payoff calculator
- [x] 3.6 Write property tests for debt calculator (Properties 17, 18, 19, 20)
- [x] 3.7 Implement cash-flow projection engine
- [x] 3.8 Write property tests for cash-flow projections (Properties 21, 22, 23)
- [x] 3.9 Implement AI claim verification
- [x] 3.10 Write property test for AI claim verification (Property 16)

### 4. Accounts & Transactions [COMPLETE]

- [x] 4.1 Implement AccountModule with CRUD operations
- [x] 4.2 Implement TransactionModule with CRUD and search
- [x] 4.3 Implement duplicate detection for transactions
- [x] 4.4 Write property test for duplicate detection (Property 4)

### 5. Categories & Budgets [COMPLETE]

- [x] 5.1 Implement CategoryModule with CRUD and hierarchy
- [x] 5.2 Write property tests for category hierarchy (Properties 7, 8)
- [x] 5.3 Implement BudgetModule with CRUD and progress tracking
- [x] 5.4 Implement budget threshold notifications

### 6. Rules Engine [COMPLETE]

- [x] 6.1 Implement RulesModule with CRUD and evaluation logic
- [x] 6.2 Implement dry-run and retroactive rule application
- [x] 6.3 Write property tests for rules engine (Properties 11, 12, 13)

### 7. Importers [COMPLETE]

- [x] 7.1 Implement CSV, OFX, and QFX parsers
- [x] 7.2 Implement CSV export and round-trip support
- [x] 7.3 Write property tests for import/export (Properties 5, 6)
- [x] 7.4 Implement ImportModule in apps/api

### 8. AI Engine [COMPLETE]

- [x] 8.1 Create AI provider abstraction and Ollama provider
- [x] 8.2 Implement cloud providers and privacy mode routing
- [x] 8.3 Implement AI categorization engine
- [x] 8.4 Write property tests for AI categorization (Properties 14, 15)
- [x] 8.5 Write property test for AI privacy mode routing (Property 29)
- [x] 8.6 Implement AI chat interface with Finance Engine verification

### 9. Worker & Background Jobs [COMPLETE]

- [x] 9.1 Set up BullMQ worker with queue consumers
- [x] 9.2 Implement AI categorization batch job
- [x] 9.3 Implement recurring transaction detection job
- [x] 9.4 Write property tests for recurring detection (Properties 24, 25)

### 10. Recurring, Cash-Flow & Debt API [COMPLETE]

- [x] 10.1 Implement RecurringModule
- [x] 10.2 Implement CashFlowModule
- [x] 10.3 Implement DebtModule
- [x] 10.4 Implement AIChatModule

### 11. Backup & Settings [COMPLETE]

- [x] 11.1 Implement BackupModule with create, restore, and scheduling
- [x] 11.2 Write property tests for backup service (Properties 26, 27, 28)
- [x] 11.3 Implement SettingsModule
- [x] 11.4 Implement data encryption utilities

### 12. Frontend [COMPLETE]

- [x] 12.1 Set up Next.js application with core layout and routing
- [x] 12.2 Implement authentication pages and session handling
- [x] 12.3 Implement dashboard, accounts, and transaction pages
- [x] 12.4 Implement budget, category, and import pages
- [x] 12.5 Implement rules, debt calculator, and cash-flow pages
- [x] 12.6 Implement AI chat page and recurring transactions page
- [x] 12.7 Implement settings and backup management pages

### 13. PWA [COMPLETE]

- [x] 13.1 Implement service worker with offline caching and action queue
- [x] 13.2 Create PWA manifest and install support
- [x] 13.3 Write property test for offline action queue (Property 32)

### 14. Deployment [COMPLETE]

- [x] 14.1 Create Dockerfiles for all apps
- [x] 14.2 Create Docker Compose configuration
- [x] 14.3 Implement startup migration and upgrade support
- [x] 14.4 Fix Dockerfile Node version (18 → 22 to match engine requirement)
- [x] 14.5 Create .dockerignore (exclude node_modules, .git, .turbo, dist)
- [x] 14.6 Fix Next.js standalone output (add `output: 'standalone'` to next.config.js)
- [x] 14.7 Fix turbo filter names in Dockerfiles (@budgetapp → @wardkeep)
- [x] 14.8 Fix docker-compose.demo.yml Dockerfile paths (apps/*/ → docker/)
- [x] 14.9 Fix NEXT_PUBLIC_API_URL for browser access (not internal Docker hostname)
- [x] 14.10 Fix next.config.js transpilePackages reference (@budgetapp → @wardkeep)
- [x] 14.11 Add restart policies and production secrets guidance
- [x] 14.12 Verify full `docker compose up` builds and runs successfully
- [x] 14.13 Verify demo compose builds and runs successfully

### 15. Notifications & Integration [COMPLETE]

- [x] 15.1 Implement NotificationModule with WebSocket gateway
- [x] 15.2 Wire all modules together and verify end-to-end flows
- [x] 15.3 Write integration tests for critical user journeys

### 16. UI Redesign [COMPLETE]

- [x] 16.1 Set up design system foundations (dark-mode-first, Lucide icons, CSS variables)
- [x] 16.2 Redesign app shell and navigation
- [x] 16.3 Redesign dashboard page
- [x] 16.4 Redesign transactions page
- [x] 16.5 Redesign budget page
- [x] 16.6 Redesign accounts page
- [x] 16.7 Redesign categories/spending page
- [x] 16.8 Redesign remaining pages
- [x] 16.9 Add micro-interactions and polish
- [x] 16.10 Accessibility and responsiveness pass

### 17. Demo Instance [COMPLETE]

- [x] 17.1 Create demo seed dataset
- [x] 17.2 Implement demo mode with data reset
- [x] 17.3 Lightweight deploy configuration

### 18. Bank Sync [COMPLETE]

- [x] 18.1 Integrate SimpleFIN for bank account auto-connection

---

## Phase 2 — The Decision Engine [IN PROGRESS]

> Goal: Transform the finance app into a decision engine. Build the Readiness Engine, Advisor, and Household Timeline. This is what makes Wardkeep fundamentally different from every other finance app.

### 19. Readiness Engine Core (packages/readiness) [FOUNDATION SHIPPED]

- [x] 19.1 Create packages/readiness with core types and scoring logic
  - Define Signal, Observation, Recommendation, ReadinessSnapshot types
  - Define ReadinessPillar enum (protection, provision, preparation, prosperity, peace)
  - Implement `computePillarScore(pillar, signals)` — deterministic, pure function
  - Implement `computeOverallReadiness(pillarScores, weights)` — weighted average
  - Implement `computePeace(pillarScores, history)` — derived stability indicator
  - All functions pure, no I/O, fully property-testable
  - Use Decimal.js where financial values feed into scores

- [~] 19.2 Implement signal aggregation and snapshot storage
  - [x] ReadinessService collects current finance-generator signals
  - [ ] Store durable signals and observations in PostgreSQL (Signal model from technical-architecture.md)
  - [x] ReadinessSnapshot model — daily score persistence
  - [x] Run daily snapshot creation through a BullMQ worker job; the Dashboard endpoint retains a best-effort current-day snapshot for immediate history
  - [x] API endpoint: GET /api/readiness — returns score, pillars, signals, coverage, and history

- [~] 19.3 Implement readiness explainability
  - [x] Current response includes contributing signals and dashboard surfaces their summaries
  - [x] Create a structured readiness explanation response with pillar details, evaluated/not-evaluated factors, and score-change reasons
  - [x] API endpoint: GET /api/readiness/explain — full breakdown with signal attributions
  - [ ] Link every point to a durable observation/capability and add per-pillar trend labels

- [~] 19.4 Implement readiness history and trends
  - [x] API endpoint: GET /api/readiness/history — score snapshots over time
  - [x] Dashboard renders up to 90 days of available score history
  - [x] Retain the newest 365 daily snapshots per household and expose 1–365 days through the history endpoint
- [~] Compute 7-day, 30-day, 90-day trend indicators and score-change reasons
  - [x] Return available 7-, 30-, and 90-day score comparisons with their actual elapsed period.
  - [x] Store the observed overall score used by the Dashboard, never a synthetic score for an unevaluated household.
  - [ ] Add durable causal explanations for score changes, not only changed factors.
  - [ ] Detect seasonal patterns (optional, AI-enhanced later)

- [x] 19.5 Write property tests for Readiness Engine
  - [x] **Property 34:** Pillar score is deterministic given same signals
  - [x] **Property 35:** Overall readiness is weighted average of pillar scores
  - [x] **Property 36:** Peace score derives from minimum pillar and volatility
  - [x] **Property 37:** No signals is never treated as perfect readiness; the API/UI must mark it not evaluated
  - [x] **Property 38:** Signal magnitude bounded to [-10, +10] clamps correctly
  - [x] Generate random signal sets; verify deterministic, bounded, explainable output

### 20. Finance Capability Signals [PARTIAL]

- [~] 20.1 Define finance signal generators
  - Budget adherence signal: risk when >90% spent, opportunity when consistently under
  - [x] Graduated liquid-reserve signal from 0 through 12 months of filtered ordinary expenses
  - [ ] Essential-versus-normal burn rate, transfer matching, and one-time-expense handling
  - Debt-to-income ratio signal: risk when >36%, warning when >28%
  - Cashflow forecast signal: risk when projected negative within 30 days
  - Net worth trend signal: positive when growing month-over-month
  - Recurring payment reliability signal: risk when missed payments detected

- [~] 20.2 Wire existing finance services to emit signals
  - [x] Current generators derive signals on readiness evaluation
  - [ ] Recompute signals on relevant writes and scheduled syncs
  - [ ] Store signals/observations in DB and feed them through a versioned pipeline

- [ ] 20.3 Implement Capability interface for finance
  - Create FinanceCapability class implementing the Capability interface
  - Register with CapabilityRegistry at API startup
  - Wire observations(), signals(), recommendations(), dashboardCards(), timelineEvents()
  - This wraps existing services — no rewrite of business logic

- [ ] 20.4 Write tests for finance signal generation
  - Test: budget at 95% → risk signal with correct magnitude
  - Test: emergency fund at 2 months → risk signal
  - Test: net worth increasing 3 consecutive months → positive signal
  - Test: projected negative cashflow in 14 days → warning signal
  - Verify signal magnitudes are proportional and bounded

### 21. Capability Registry & SDK

- [ ] 21.1 Create packages/capability-sdk with base interfaces
  - Define Capability, CapabilityMetadata, CapabilityRegistry interfaces
  - Define Observation, Signal, Recommendation, DashboardCard, TimelineEvent types
  - Export ReadinessPillar type
  - This becomes the contract for all future Capabilities (core and community)

- [ ] 21.2 Implement CapabilityRegistry in apps/api
  - NestJS service that manages Capability lifecycle (register, enable, disable)
  - Per-household capability enablement (stored in DB)
  - API endpoints: GET /api/capabilities, POST /api/capabilities/:id/enable|disable
  - At startup: auto-register all core Capabilities

- [ ] 21.3 Implement Capability data isolation
  - Each Capability's data scoped to householdId
  - Capabilities cannot read other Capabilities' raw data
  - Cross-capability reasoning happens only through published signals (via Readiness Engine)

### 22. Advisor & Morning Brief

- [ ] 22.1 Evolve AI Engine into Advisor
  - Rename/refactor ai-chat to Advisor service
  - Advisor receives: readiness scores, signals from all Capabilities, household context
  - Advisor produces: natural-language explanations, prioritized recommendations, briefs
  - Advisor never modifies scores — only interprets and explains them

- [~] 22.2 Implement Morning Brief generation
  - API endpoint: GET /api/advisor/brief/morning
  - Contents: greeting, readiness score, today's priority, this week's events, top recommendation, current risk
  - [x] Deterministic version (no AI): template-based using signals and timeline data
  - AI-enhanced version: natural language generated from same data (when Advisor available)
  - Fallback gracefully if AI unavailable — deterministic brief always works

- [~] 22.3 Implement Weekly and Monthly Briefs
  - [x] GET /api/advisor/brief/weekly — recorded score change, completed recommendations, observed risks, and upcoming week
  - [x] GET /api/advisor/brief/monthly — recorded month trend, completed recommendations, observed risks, and upcoming month
  - [x] Include: recorded score changes, actions taken, recommendations completed, and newly observed risks when a comparison snapshot exists

- [~] 22.4 Implement recommendation prioritization
  - [x] GET /api/advisor/recommendations — returns the recorded priority order after refreshing observed signals
  - [x] Each recommendation links to its source Capability and signal
  - [x] User can dismiss or complete a recommendation from the Recommendations workspace
  - [x] Track recommendation completion and observed score changes since completion (without causal attribution)

- [~] 22.5 Implement cross-capability reasoning
  - [x] Advisor has read access to signals from all active Capabilities simultaneously
  - [~] Generate deterministic insights that span supported domains
  - [x] Store generated insights; deduplicate matching observations within 7 days

### 23. Household Timeline [PARTIAL]

- [~] 23.1 Implement Timeline service and API
  - [x] GET /api/timeline/upcoming — chronological recorded events for 1–365 days
  - [x] API endpoint: GET /api/timeline — unified chronological view with past recorded dates and future capability sources
  - [x] GET /api/timeline/history — past recorded dates, clearly distinguished from confirmed outcomes
  - Each event: title, date, capability source, actionRequired flag, status

- [~] 23.2 Wire finance events into Timeline
  - [x] Confirmed recurring bills, recorded policy renewals, expected income dates, and planned expenses → upcoming events
  - [x] Household-entered financial-goal target dates → upcoming and recorded-history events
  - [x] Recorded budget period start/end → upcoming events
  - [x] Recorded debt payoff-plan projections → upcoming events

- [~] 23.3 Implement Timeline UI
  - [x] Scrollable, grouped upcoming timeline with 30/90/365-day views and direct source links
  - [x] Past ← today → future recorded-date views
  - [x] Color-code capability sources and highlight action-required events when source semantics support it
  - [x] Click event → navigate to relevant Capability view
  - [x] Mobile-friendly compact cards

### 24. Readiness Dashboard & Brief UI [PARTIAL]

- [~] 24.1 Implement Readiness dashboard (replaces old dashboard)
  - [x] Hero: readiness score, coverage/confidence, strongest/most-limited pillar, and trend indicator
  - [x] Pillar cards: score, coverage, and contributing signal summaries
  - [x] Needs attention and Wardkeep recommends sections
  - [x] Pillar-detail explanations, score-change reasons, Coming up, and Since your last visit

- [~] 24.2 Implement Morning Brief UI (new home screen)
  - [x] Greeting with readiness score
  - [x] Today's priorities (from Advisor)
  - [x] This week's timeline events
  - [x] Top recommendation with one-tap actions
  - [x] Active risks summary
  - [x] This becomes the landing page after login

- [x] 24.3 Implement Advisor conversation UI (replaces AI Chat)
  - [x] Rebrand from "AI Chat" to "Advisor"
  - [x] Advisor context includes readiness state and signals
  - [x] Responses include linked readiness references for the currently observed risk pillars
  - [x] Quick actions: "Explain my score", "What should I prioritize?", "What if I lose my job?"

- [x] 24.4 Implement Timeline UI page
  - [x] Full-page scrollable timeline
  - [x] Filter by Capability, by pillar, by action-required
  - [x] Past events show recorded-date status without inferring completion
  - [x] Future events show countdown/proximity

### 24.5 Financial Overview accuracy [COMPLETE]

- [x] Replace reconstructed average spending pace with actual cumulative transaction totals by date
- [x] Replace mid-month “under/over budget” wording with remaining allocation, pace against expectation, and projected month-end spending

### 25. Phase 2 Checkpoint

- [x] 25.1 Verify Readiness Engine produces correct, explainable scores (automated readiness and API suites)
- [ ] 25.2 Verify Morning Brief renders with real finance data
- [ ] 25.3 Verify Timeline shows upcoming bills, paydays, and milestones
- [ ] 25.4 Verify Advisor can explain readiness changes
- [x] 25.5 All property tests pass (Properties 34–38+)
- [ ] 25.6 Docker Compose stack works with new features
- [~] 25.7 Demo instance updated with readiness, Timeline, and Advisor data

---

## Phase 3 — Household Platform [FUTURE]

> Goal: Expand beyond finance. Add Capabilities for other household domains. Each new Capability plugs into the same pipeline without modifying the Readiness Engine.

### 26. Additional Capabilities

- [x] 26.1 Vehicle Capability
  - [x] Track vehicles: make, model, year, mileage, ownership, lease/loan details, and recorded valuations
  - [x] Maintenance schedules (oil change, tires, registration, inspection)
  - [x] Signals: overdue maintenance → risk, upcoming registration → timeline event
  - Pillar: Preparation

- [x] 26.2 Insurance Capability
  - [x] Track policies: type, provider, premium, deductible, coverage, renewal date
  - [x] Signals: renewal approaching → timeline + recommendation, coverage gap → risk
  - [x] Cross-capability: correlate deductible with emergency fund
  - Pillar: Protection

- [x] 26.3 Home Maintenance Capability
  - [x] Track appliances: type, age, expected lifespan, replacement cost
  - [x] Maintenance tasks: HVAC filter, gutter cleaning, roof inspection
  - [x] Signals: appliance nearing end-of-life → risk + sinking fund recommendation
  - Pillar: Preparation

- [ ] 26.4 Estate Capability
  - Track: will status, beneficiaries, document locations, power of attorney
  - Signals: no will → critical risk, outdated beneficiaries → warning
  - Pillar: Protection

- [ ] 26.4a Household transition and trusted-access workspace
  - Provide two distinct modes: an **incapacity continuity plan** for a living household member and an **after-death settlement plan**. Starting either mode is a deliberate, auditable household workflow—not a legal finding that someone is incapacitated or deceased—and must never change financial accounts, sessions, ownership, or scores automatically.
  - Provide a calm, step-by-step view of the household information already recorded: accounts and institutions, insurance policies and contacts, recurring obligations, estate-document locations, trusted contacts, and user-entered instructions. It must identify missing information rather than inventing it.
  - Include optional planning checklists for immediate arrangements, including funeral or memorial planning, notifications, recurring-bill review, document gathering, and professional-support prompts. The product provides organization, not legal, tax, financial, medical, or funeral-direction advice.
  - Let a household owner separately record an incapacity agent (such as a power-of-attorney contact), a potential executor/personal representative, and a surviving-household contact. A recorded designation is not proof of authority and must never bypass authentication, replace legal verification, or grant access automatically. The interface must state that authority and terminology vary by jurisdiction, and that an agent’s authority may end at death while an executor/personal representative handles the estate.
  - Require explicit invitation, approval, revocation, least-privilege data scopes, and immutable access audit history before a trusted person can view household information. Provide emergency lockout and export/delete controls.
  - Store document locations and notes by default, not will/trust, identity, medical, or funeral-document contents. Any future encrypted document vault needs separate consent, recovery, retention, and threat-model review.
  - Add a pre-event readiness check: confirm who is designated, what they can see, where documents and contacts are located, what information is missing, and whether the household has reviewed the plan recently. Provide a downloadable, owner-approved handoff summary; never release it automatically based on inactivity or a reported death.
  - Make the first release a neutral organizer and checklist, not a marketplace, legal-document generator, bank-action tool, credential vault, or automated notification sender.
  - Pillars: Protection and Peace. Readiness uses only explainable record-completeness or review-date signals; bereavement status and access designations must not be scored as preparedness or risk.

- [ ] 26.5 Emergency Preparedness Capability
  - Track: food storage, water, first aid, important documents, evacuation plan
  - Signals: incomplete preparation → risk, fully prepared → milestone
  - Pillar: Protection

### 27. Capability Marketplace Infrastructure

- [ ] 27.1 Define Capability packaging format
  - Standard directory structure for community Capabilities
  - Manifest file (metadata, pillar mapping, dependencies)
  - Validation: type-check against capability-sdk interfaces
  - Versioning and compatibility constraints

- [ ] 27.2 Implement Capability installation and management
  - Browse available Capabilities (marketplace API)
  - Install/uninstall Capabilities per household
  - Capability isolation: sandboxed data access
  - Update mechanism for installed Capabilities

---

## Phase 4 — Marketplace & Community [FUTURE]

> Goal: Enable third-party developers to build and sell Capabilities. Community shares templates, strategies, and automations.

### 28. Marketplace

- [ ] 28.1 Marketplace API and developer portal
- [ ] 28.2 Capability review and publishing pipeline
- [ ] 28.3 Revenue sharing (10-20% platform fee)
- [ ] 28.4 Community templates (budget templates, debt strategies, automation flows)
- [ ] 28.5 Prompt libraries and rule presets

### 29. Community Features

- [ ] 29.1 Shared templates and strategies
- [ ] 29.2 Community Capability contributions (open source)
- [ ] 29.3 User forums or Discord integration

---

## Phase 5 — Cloud & Convenience [FUTURE]

> Goal: Offer hosted Wardkeep for users who don't want Docker. Sell convenience, not capability.

### 30. Wardkeep Cloud

- [ ] 30.1 Multi-tenant hosted infrastructure
- [ ] 30.2 Automated backups and updates
- [ ] 30.3 Hosted AI (no user API keys needed)
- [ ] 30.4 Bank sync included
- [ ] 30.5 Multi-device sync service
- [ ] 30.6 Mobile push notifications
- [ ] 30.7 OCR receipt scanning
- [ ] 30.8 Email/SMS transaction parsing

### 31. Wardkeep Pro (Self-Hosted Add-ons)

- [ ] 31.1 Bank sync subscription ($5/month)
- [ ] 31.2 Cloud AI models subscription ($5/month)
- [ ] 31.3 Cloud backup service
- [ ] 31.4 Priority updates channel
- [ ] 31.5 Support tier ($99/year — guaranteed updates, priority Discord, migration help)

---

## Phase 6 — Enterprise [FUTURE]

> Goal: Serve businesses, churches, schools, nonprofits, and large families with team-based features.

### 32. Enterprise Features

- [ ] 32.1 LDAP/SAML authentication
- [ ] 32.2 Teams and role-based permissions
- [ ] 32.3 Audit logs and compliance reporting
- [ ] 32.4 Advanced access policies
- [ ] 32.5 White-label licensing (credit unions, financial advisors, churches)
- [ ] 32.6 Dedicated support and SLAs

---

## Ongoing Enhancements (Phase 1 Polish)

> These improve the existing finance foundation. Can be tackled alongside Phase 2 work.

### 39. Readiness Trust & Household Coverage [NEXT]

> Readiness must become more complete without ever overstating certainty. This work precedes assigning broad meaning to a household score.

- [x] 39.1 Replace numeric unknown sentinels with an explicit readiness assessment contract
  - [x] Per-pillar state: `known`, `partial`, or `not_evaluated`, with nullable scores and evaluated capabilities returned by `GET /api/readiness`
  - [x] Overall assessment re-normalizes weights across evaluated direct pillars, is nullable with no evidence, and is marked partial until coverage is sufficient
  - [x] Missing factors, account-source summary, score evaluation time, and factor-level provenance (sources, method, and limitation) are displayed

- [x] 39.2 Add data provenance and freshness
  - Source states: synchronized, manual, estimated, inferred, calculated, stale, unknown
  - [x] Display synchronized/manual/stale account summary and score evaluation time in relevant UI
  - [x] Qualify displayed confidence as “Freshness needs review” whenever one or more connected accounts are stale; coverage remains a separate measure of evaluated factors
  - [x] Treat manual accounts as a separate source state rather than calling them stale solely because their record is older; only overdue or never-completed connected-account syncs affect freshness confidence
  - [x] Show a per-factor evidence state (synchronized, manual, mixed, stale, calculated, or unknown) alongside sources, method, and limitation
  - [x] Apply stale freshness only to the account scope a signal depends on; unrelated stale accounts do not downgrade its evidence state

- [x] 39.3 Harden the Protection liquidity model
  - [x] Structurally exclude transfer records and remove common imported transfer, credit-card-payment, investment, savings-transfer, and principal-payment debits from burn rate
  - [x] Distinguish categorized essential burn rate from ordinary household spending, and disclose the ordinary-spending fallback
  - [x] Cover zero, <1, 1–3, 3–6, 6–12, and 12+ months plus no-expense history with deterministic scoring tests
  - [x] Match a checking/savings debit with an equal household credit-card credit within three days; exclude only the matched debit and test duplicate-payment handling
  - [x] Let a household explicitly and reversibly mark a debit as `one-time`; exclude only that marked transaction from burn-rate calculations and display its status in Transactions

- [~] 39.4 Add composite Protection capabilities
  - [x] Insurance policy records (type, provider, premium and frequency, deductible, coverage amount, renewal date), explainable renewal-timing signals, and recorded-deductible-to-liquid-reserve warning
  - [x] Seed representative policies for the demo household, including an upcoming renewal
  - [x] Record separate versus mortgage/loan/other bundled premiums, linked payment account, and home property-tax escrow to prevent future cash-flow double counting
  - [x] Surface policy completeness and renewal attention on the dashboard and Protection detail page; support reversible inactive/restore lifecycle for cancelled or replaced policies
  - [x] Document local `db push` versus production/baselined `migrate deploy` workflow for this schema addition
  - [x] Estate-planning records with reversible lifecycle, optional review dates, a limited review-timing signal, dashboard action, demo data, and explicit legal-adequacy limits
  - [x] Income-source planning records with expected net amount, frequency, optional review date, a limited review-timing signal, dashboard action, and demo data
  - [x] Record a credit-card limit and show calculated available borrowing capacity without treating it as cash reserves; warn modestly when a recorded line is 90% used without granting Protection credit
  - [x] Compare recorded monthly debt minimums with liquid reserves and warn only when the recorded minimums exceed current reserves
  - [x] Dependent planning records with optional labels and review dates, limited review-timing signals, and explicit care/coverage adequacy limits
  - [~] Insurance adequacy, disability/life coverage, estate-document adequacy, dependent needs, true income-interruption resilience, and unrecorded or variable fixed obligations
    - [x] Compare a recorded policy amount with a household-entered coverage target without inferring insurance adequacy
    - [x] Include confirmed recurring bills with recorded debt minimums in the liquid-reserve commitment check; unrecorded and variable obligations remain unknown
    - [x] Let households record external funding commitments outside Wardkeep’s tracked accounts and label variable amounts as estimates; tracked spending must not be duplicated
  - Keep every component independently explainable; missing data remains unknown

- [~] 39.5 Create durable recommendations and impact previews
  - [x] Link each current dashboard signal to its relevant household workflow (accounts, policies, budget, cash flow, recurring bills, debt, or an explainable readiness factor)
  - [x] Persist active risk and warning recommendations with stable source-signal fingerprints; preserve dismissed/completed state and resolve only active recommendations whose source signal disappears
  - [x] Expose `GET /api/recommendations` and completion/dismissal updates, ranked deterministically by severity, urgency, actionability, and evidence freshness
  - [x] Display active persisted recommendations in the Dashboard with direct actions and completed/dismissed controls
  - [x] Provide a Recommendations page for active actions and completed, dismissed, or automatically resolved history
  - [x] Show a truthful 30-day Coming Up view from recorded recurring-payment dates and policy renewals, without inventing unrecorded events
  - [x] Show a qualified pillar-only impact preview when removing a source risk leaves other observed pillar factors; otherwise state that Wardkeep will measure rather than predict the change
  - [~] Add financial-impact weighting, estimated monthly amount, time to completion, and an impact-preview interface
    - [x] Persist and display recorded financial gaps and known due dates without estimating missing timing
    - [x] Show the recorded monthly commitment amount alongside its immediate liquid-reserve shortfall

- [x] 39.6 Establish GitHub launch tracking
  - [x] Publish the outcome-oriented release roadmap, task-plan link, and progress map on GitHub Pages; validate it in CI with locked Jekyll dependencies
  - [x] Create the public **Decision Engine / Launch Readiness** GitHub Project with the active launch gates
  - [x] Seed the current independently reviewable launch outcomes with task-plan links and acceptance criteria
  - [x] Apply `phase/*`, `area/*`, `priority/*`, and `status/*` labels to those issues; add milestones as release gates become defined
  - [x] Repair the legacy task-sync scripts and hooks so they use the Wardkeep repository and explicit issue references rather than keyword-only matching

### 33. Income & Spending Intelligence

- [ ] 33.1 Income configuration and pay schedule
  - [x] Record pay frequency and an optional next expected income date; show only recorded income dates in Dashboard Coming Up
  - Expected net per paycheck
  - Salary vs hourly tracking
  - Dashboard: "Next paycheck: ~[date]"

- [ ] 33.2 Spending trends and monthly comparisons
  - [x] Show current-month recorded income, spending, net, and income-relative savings rate on the dashboard
  - [x] Month-over-month category spending comparison
  - [x] Income vs expenses and savings rate
  - [x] Per-category change indicators
  - [x] 6/12-month trend visualizations

- [x] 33.3 Spending pace line visualization
  - [x] Cumulative daily spending vs ideal pace line in Financial Overview
  - [x] Pace indicator with a recorded month-end projection; green/amber/red reflects under pace, near pace, or over pace/recent acceleration
  - [x] Budget detail shows elapsed-day pace, recorded month-end projection, and the amount over or under pace

### 34. Transaction Workflow

- [x] 34.1 Transaction review/inbox workflow
  - [x] `isReviewed` field; imported and bank-synced transactions start unreviewed while existing and manually entered records remain reviewed
  - [x] Filter transaction lists by review state and mark an individual transaction reviewed through the API
  - [x] Demo household includes unreviewed transactions for inbox verification
  - [x] "Mark as Reviewed" action (single and selected-inbox bulk)
  - [x] Unreviewed count badge in navigation
  - [x] Filter for unreviewed transactions

- [x] 34.2 Tags support
  - [x] Tag model with many-to-many relation to transactions
  - [x] Transaction tag CRUD and tag filter in search
  - [x] Rules engine can auto-apply tags
  - [x] Inline transaction tag editing and filtering UI

- [ ] 34.3 Refund matching
  - [x] Detect equal credits from the same merchant within 90 days
  - [x] Return candidate purchase/refund pairs and require explicit confirmation
  - [x] Confirmed refunds reduce the linked purchase in Budget totals while preserving both transactions

### 35. Budgeting Enhancements

- [ ] 35.1 Budget rollovers
  - Track unspent per category at month end
  - Roll forward to next month automatically
  - Show rollover amount separately in UI
  - Per-category opt-in/out

- [x] Planned-expense lifecycle
  - [x] Mark a one-time planned expense as no longer planned without deleting it, excluding it from readiness and Timeline.
  - [x] Restore an inactive planned expense when it becomes relevant again.

- [ ] 35.2 Subscription management view
  - [x] Dedicated /subscriptions page
  - [x] Group subscriptions by active, upcoming, and annual renewals
  - [x] Total monthly-equivalent subscription burn rate
  - Alert on cancelled subscription still charging
  - [x] Recurring workflow now lists confirmed and detected records from their separate API sources, with working confirm/dismiss actions and reversible stop-monitoring control.
  - [x] Demo household includes confirmed and detected recurring-bill records for immediate workflow verification.

### 35b. Debt Payoff Enhancements [COMPLETE]

- [x] 35b.1 Improved schedule display
  - Month-by-month consolidated view (all debts shown per month)
  - Per-debt summary cards with payoff month and total interest
  - Month total rows and "Paid Off" status indicators
  - Configurable time horizon (12/24/60/all months)

- [x] 35b.2 Debt consolidation calculator
  - Model refinancing into single fixed-rate loan
  - Inputs: new APR, term (months), origination fee %
  - Outputs: monthly payment, total interest, total cost
  - Comparison against minimum-only baseline

- [x] 35b.3 Velocity banking (HELOC chunking) calculator
  - Model using a line of credit for lump-sum debt payments
  - Inputs: HELOC limit, HELOC APR, monthly disposable income, chunk amount
  - Shows debt interest + HELOC interest (combined cost)
  - Comparison against minimum-only baseline

- [x] 35b.4 Minimum-only baseline calculator
  - Calculates time and interest using only minimum payments
  - Serves as comparison benchmark for all advanced strategies

### 36. Investment & Asset Tracking

- [ ] 36.1 Investment account support
  - Account types: BROKERAGE, RETIREMENT, CRYPTO
  - Holdings model: ticker, quantity, cost basis
  - Market data API integration for live prices
  - Portfolio value, daily change, asset allocation
  - Include in net worth

- [ ] 36.2 Real estate tracking
  - Account type: REAL_ESTATE
  - Property valuation (manual or API)
  - Home equity calculation (value - mortgage)
  - Include in net worth

### 37. Personalization

- [ ] 37.1 Custom themes and color personalization
  - Theme engine with CSS variables
  - Preset themes: Midnight, Slate, Ocean, Forest, Sunset, Lavender, Mono
  - Custom accent color picker
  - Export/import themes as JSON
  - Accessibility contrast checks

### 38. Remote Wardkeep Backup (Peer-to-Peer Off-Site)

- [ ] 38.1 Design remote backup protocol and authentication
  - Define API endpoints on the receiving server: POST /api/remote-backup/register (pair devices), POST /api/remote-backup/push (receive encrypted backup), GET /api/remote-backup/pull (retrieve backup for restore)
  - Pairing flow: server A generates a one-time pairing token, user enters it on server B to establish trust
  - Store pairing as `RemoteBackupPeer` model: peerId, peerUrl, peerName, sharedSecret (for HMAC verification), status (PAIRED/REVOKED), lastSyncAt
  - All data encrypted client-side (AES-256-GCM with user passphrase) before transmission — receiving server stores opaque blobs
  - HMAC signature on every request using shared secret (prevents unauthorized pushes)
  - TLS required for transport (reject plain HTTP peer URLs)

- [ ] 38.2 Implement RemoteBackupPeer Prisma model and migrations
  - Add `RemoteBackupPeer` model: id, userId, peerUrl, peerName, sharedSecret (encrypted at rest), direction (PUSH/PULL/BOTH), status, lastSyncAt, lastError, createdAt, updatedAt
  - Add `RemoteBackup` model: id, peerId, userId, filename, size, checksum (SHA-256), createdAt
  - Relation: User hasMany RemoteBackupPeer, RemoteBackupPeer hasMany RemoteBackup
  - Migration adds indexes on [userId, status] and [peerId, createdAt]

- [ ] 38.3 Implement remote backup sender service (push side)
  - `RemoteBackupService.pushBackup(userId, peerId)`: creates encrypted backup (reuse existing createBackup logic), POSTs to peer's /api/remote-backup/push endpoint
  - Retry with exponential backoff (3 attempts, 5s/30s/120s delays)
  - Verify peer responds with matching checksum (SHA-256 of received blob)
  - Update lastSyncAt on success, lastError on failure
  - Emit audit log entry for every push attempt (success/failure)
  - Queue-based: push jobs run via BullMQ worker (not blocking API thread)

- [ ] 38.4 Implement remote backup receiver service (pull side)
  - POST /api/remote-backup/push endpoint: validates HMAC signature, stores encrypted blob to disk/configured storage, records metadata in RemoteBackup table
  - Enforce per-peer storage quota (configurable, default 500MB)
  - Enforce max backup count per peer (configurable, default 10, FIFO eviction)
  - GET /api/remote-backup/pull/:backupId endpoint: serves stored blob back to paired peer (HMAC-authenticated)
  - GET /api/remote-backup/list endpoint: returns metadata of stored backups for a peer

- [ ] 38.5 Implement pairing flow (trust establishment)
  - POST /api/remote-backup/pair/generate: creates one-time token (UUID + shared secret), valid 15 minutes
  - POST /api/remote-backup/pair/accept: remote server calls this with token to complete pairing
  - Exchange: both sides store each other's URL + shared secret
  - POST /api/remote-backup/peer/:id/revoke: terminates pairing, deletes stored backups from peer
  - Show pairing status in UI: paired peers list with last sync time, connection health

- [ ] 38.6 Implement automatic sync scheduling
  - Per-peer sync schedule: HOURLY, EVERY_6H, DAILY, WEEKLY (stored in RemoteBackupPeer)
  - BullMQ repeatable job checks for peers due for sync
  - Health check: periodic ping to peer URL (HEAD /api/remote-backup/health)
  - Mark peer as UNREACHABLE after 3 consecutive failures, notify user
  - Auto-resume when peer comes back online

- [ ] 38.7 Implement remote restore flow
  - User initiates restore from remote peer: GET peer's /api/remote-backup/list, select backup, GET /api/remote-backup/pull/:id
  - Download encrypted blob, decrypt locally with user's passphrase (same as local restore)
  - Reuse existing restoreBackup logic after decryption
  - Support "fresh instance" restore: new Wardkeep install can pair with friend's server and pull latest backup to bootstrap all data

- [ ] 38.8 Implement remote backup management UI
  - Settings → Remote Backups page
  - Add peer: enter peer URL, initiate pairing (show token or accept token)
  - Peer list: name, URL, status, last sync, storage used
  - Per-peer actions: sync now, view history, change schedule, revoke
  - Restore from remote: browse peer's stored backups, select, enter passphrase, restore
  - Connection health indicator (green/yellow/red)

- [ ] 38.9 Write tests for remote backup system
  - Unit tests: HMAC signing/verification, encryption round-trip, quota enforcement, FIFO eviction
  - Integration tests: full push/pull cycle with mocked HTTP (Supertest for receiver endpoints)
  - Test pairing flow: generate token → accept → verify mutual trust
  - Test restore from remote: push backup → pull on fresh instance → verify data integrity
  - Test error scenarios: peer offline, quota exceeded, invalid HMAC, expired pairing token

---

---

## Scenario Modeling [Phase 2+]

> "What happens to my readiness if...?" — the ultimate preparedness question.

### 39. What-If Engine

- [ ] 39.1 Implement scenario readiness computation
  - Accept hypothetical signal changes (lose job, buy house, pay off debt)
  - Recompute all pillar scores with modified signals
  - Show projected readiness trajectory over time
  - API endpoint: POST /api/readiness/scenario

- [ ] 39.2 Implement scenario UI
  - "What if" panel with common scenarios as presets
  - Custom scenario builder (adjust income, add expense, remove account)
  - Side-by-side: current readiness vs projected
  - Advisor explains implications of each scenario

---

## AI Memory & Proactive Intelligence [Phase 2+]

> The Advisor remembers. It learns patterns, anticipates needs, and surfaces insights before you ask.

### 40. AI Memory

- [ ] 40.1 Implement Advisor memory system
  - Store learned patterns: seasonal spending, annual events, user preferences
  - Reference past context: "Last year you spent ~$900 on Christmas"
  - Track recommendation outcomes: which advice was followed, what happened after
  - Memory is per-household, stored locally, never sent to cloud

### 41. Proactive Intelligence

- [ ] 41.1 Implement proactive daily briefing generation
  - Worker job (configurable time) generates personalized briefing
  - Detects: unusual charges, budgets running hot, spending shifts
  - Suggests: recategorizations, savings opportunities, risk mitigations
  - Each suggestion actionable with one-tap approve/dismiss
  - Advisor learns from dismissed suggestions to reduce noise

---

## Phase 7 — Wardkeep Home (Physical Appliance) [FUTURE]

> Goal: Ship a plug-and-play home server that runs the full Wardkeep stack. User powers it on, connects to their network, visits a local address, creates an account, and is running in minutes. Zero cloud dependency, zero Docker knowledge required.

### 41. Hardware Platform & OS Image

- [ ] 41.1 Select and validate reference hardware
  - Target: ARM64 SBC with 8GB+ RAM (Raspberry Pi 5 8GB, Orange Pi 5, or similar)
  - Validate Ollama + full stack fits in memory budget (~6GB active, ~1.5GB headroom)
  - Test sustained load: AI inference + DB queries + background jobs concurrently
  - Document minimum and recommended hardware specs
  - Stretch: 16GB board with NPU for accelerated inference (Orange Pi 5 Plus, Rockchip RK3588)

- [ ] 41.2 Create base OS image
  - Minimal Linux (Debian/Ubuntu Server arm64 or Alpine)
  - Pre-installed: Docker, container runtime, mDNS (Avahi for wardkeep.local)
  - Auto-start on boot: all containers via systemd service
  - Read-only root filesystem with persistent data partition
  - Watchdog timer: auto-reboot on hang

- [ ] 41.3 Create appliance Docker Compose configuration
  - `docker-compose.appliance.yml` — single-device optimized
  - Smaller Ollama model: llama3:8b Q4_K_M or phi-3-mini (fits ~4GB VRAM/RAM)
  - Resource limits per container (prevent OOM on 8GB devices)
  - Shared network, local-only bindings (no external exposure by default)
  - Persistent volumes on data partition with proper permissions

- [ ] 41.4 ARM64 container image builds
  - GitHub Actions workflow: build arm64 images natively (self-hosted runner or buildx)
  - Multi-arch manifest: amd64 + arm64 for all images
  - Optimize image size: multi-stage builds, Alpine base, strip debug symbols
  - Target: API <200MB, Web <150MB, Worker <200MB

### 42. First-Boot Setup Experience

- [ ] 42.1 Implement first-boot setup service
  - Detect first boot (no admin user exists)
  - Generate unique ENCRYPTION_KEY and persist to secure storage
  - Run Prisma migrations automatically
  - Pull Ollama model in background (show progress)
  - Seed default categories

- [ ] 42.2 Implement setup wizard UI
  - Step 1: Welcome screen with device status (network, storage, memory)
  - Step 2: Create admin account (email, password)
  - Step 3: Configure household name and timezone
  - Step 4: Choose AI model size (small/fast vs larger/smarter)
  - Step 5: Optional — connect bank (SimpleFIN) or skip
  - Step 6: Done — redirect to Morning Brief / Dashboard
  - Accessible via http://wardkeep.local or device IP

- [ ] 42.3 Implement network discovery
  - mDNS advertisement: wardkeep.local resolves to device IP
  - Fallback: DHCP hostname registration
  - Setup page shows QR code with device URL for mobile onboarding
  - Optional: UPnP/NAT-PMP for remote access setup (with explicit consent)

### 43. Device Management

- [ ] 43.1 Implement device admin panel
  - System status: CPU, RAM, disk usage, temperature
  - Container health: restart count, uptime, logs (last 100 lines)
  - Network info: IP address, hostname, connected clients
  - Storage: database size, backup size, available space
  - Accessible only to admin user, separate from main Wardkeep UI

- [ ] 43.2 Implement OTA update system
  - Check for updates: poll GHCR for new image tags (daily)
  - One-click update: pull new images, run migrations, restart containers
  - Rollback: keep previous image set, revert on failed health check
  - Update window: configurable quiet hours (default 3–5 AM)
  - Changelog shown before update with "Update Now" or "Remind Me Later"

- [ ] 43.3 Implement backup to external storage
  - USB drive backup: detect inserted USB, offer one-click backup
  - Backup contents: full DB dump + encryption key + user uploads
  - Encrypted backup file (AES-256, password set during setup)
  - Scheduled auto-backup to USB if always connected
  - Restore from USB on fresh device (migration path)

- [ ] 43.4 Implement device recovery
  - Factory reset: wipe data partition, return to first-boot state
  - Restore from backup: first-boot wizard offers "Restore from USB" option
  - Health self-check: auto-restart failed containers, fsck on boot
  - LED status indicator support (if hardware has GPIO): booting / ready / error

### 44. Security Hardening

- [ ] 44.1 Network security
  - Firewall: only expose ports 80/443 on LAN (iptables/nftables)
  - Optional HTTPS: auto-generate self-signed cert or Let's Encrypt with user domain
  - No default SSH access (user must opt-in via admin panel)
  - Automatic security updates for OS packages (unattended-upgrades)

- [ ] 44.2 Data protection
  - Full-disk encryption on data partition (LUKS, key derived from user password)
  - Encryption key never leaves device
  - Secure erase on factory reset (overwrite, not just delete)
  - No telemetry, no phone-home, no analytics — fully air-gappable

- [ ] 44.3 Physical security
  - Tamper detection: warn if case opened (if hardware supports)
  - USB lockdown: only recognize storage devices, block HID attacks
  - Boot integrity: verified boot chain if hardware supports (optional)

### 45. Performance Optimization for Constrained Hardware

- [ ] 45.1 Memory optimization
  - Tune Postgres shared_buffers and work_mem for 8GB total system
  - Limit Ollama concurrent inference to 1 (prevent OOM)
  - Node.js --max-old-space-size per container
  - Redis maxmemory policy: allkeys-lru with 256MB cap
  - Monitor and alert when memory pressure exceeds 85%

- [ ] 45.2 Storage optimization
  - Automatic DB vacuum scheduling (weekly)
  - Log rotation: 7 days retention, compressed
  - Ollama model cache management (only keep active model)
  - Prune unused Docker images after updates
  - Alert when disk usage exceeds 80%

- [ ] 45.3 AI inference optimization
  - Default to smallest viable quantized model
  - Batch categorization during idle periods (not real-time)
  - Cache frequent categorization results (merchant → category mapping)
  - Graceful degradation: skip AI features if memory too low, use rule-based fallback

### 46. Packaging & Distribution

- [ ] 46.1 Create flashing tool and documentation
  - Image builder script: compose OS + containers into flashable image
  - Balena Etcher compatible .img file
  - Documentation: hardware shopping list, flashing guide, first-boot walkthrough
  - Video tutorial for non-technical users

- [ ] 46.2 Pre-built hardware option
  - Partner with SBC manufacturer or build custom enclosure
  - Pre-flash and ship ready-to-use
  - Include: device, power supply, Ethernet cable, quick-start card
  - Pricing: hardware cost + small margin (not subscription-based)

- [ ] 46.3 Retail packaging and branding
  - Enclosure design: small, silent, living-room friendly
  - Status LED: breathing pattern when healthy, color-coded states
  - Branding: "Wardkeep Home" with minimal, premium packaging
  - Quick-start guide (printed card, <10 steps to running)

### 47. Phase 7 Checkpoint

- [ ] 47.1 Verify: fresh image boots to setup wizard within 2 minutes
- [ ] 47.2 Verify: full setup (account + model pull) completes within 15 minutes
- [ ] 47.3 Verify: all core features work on reference hardware (8GB ARM64)
- [ ] 47.4 Verify: OTA update succeeds and rolls back on failure
- [ ] 47.5 Verify: USB backup and restore produces identical state
- [ ] 47.6 Verify: device runs 30 days without intervention (stability test)
- [ ] 47.7 Verify: AI inference completes within acceptable latency (<10s for chat, <2s for categorization)
- [ ] 47.8 Verify: non-technical user can complete setup without documentation (usability test)

---

## Notes

- Tasks from Phase 1 marked `[x]` are fully implemented and deployed.
- Phase 2 is the immediate priority — this is what makes Wardkeep a decision engine.
- Phases 3–7 are documented for architectural alignment but not scheduled.
- "Ongoing Enhancements" can be interleaved with Phase 2 based on user demand.
- Every new Capability (Phase 3+) automatically benefits from the Readiness Engine and Advisor built in Phase 2.
- The Readiness Engine is deterministic. The Advisor is AI-powered. They are architecturally separate.
- Property tests continue to validate correctness. New properties (34+) cover Readiness Engine invariants.
- The terminology in this document follows `/docs/terminology.md`. Code, UI, and docs should match.
- Phase 7 (Wardkeep Home) depends on stable deployment (Phase 1 Docker), mature features (Phase 2+), and ARM64 image builds. Target only after software is production-hardened.
