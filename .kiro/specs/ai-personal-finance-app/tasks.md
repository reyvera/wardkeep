# Implementation Plan: Wardkeep — Household Intelligence Platform

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

## Phase 2 — The Decision Engine [NEXT]

> Goal: Transform the finance app into a decision engine. Build the Readiness Engine, Advisor, and Household Timeline. This is what makes Wardkeep fundamentally different from every other finance app.

### 19. Readiness Engine Core (packages/readiness)

- [ ] 19.1 Create packages/readiness with core types and scoring logic
    - Define Signal, Observation, Recommendation, ReadinessSnapshot types
    - Define ReadinessPillar enum (protection, provision, preparation, prosperity, peace)
    - Implement `computePillarScore(pillar, signals)` — deterministic, pure function
    - Implement `computeOverallReadiness(pillarScores, weights)` — weighted average
    - Implement `computePeace(pillarScores, history)` — derived stability indicator
    - All functions pure, no I/O, fully property-testable
    - Use Decimal.js where financial values feed into scores

- [ ] 19.2 Implement signal aggregation and snapshot storage
    - Create SignalService in apps/api that collects signals from Capabilities
    - Store signals in PostgreSQL (Signal model from technical-architecture.md)
    - Create ReadinessSnapshot model — daily score persistence
    - Implement snapshot creation job (daily via BullMQ)
    - API endpoint: GET /api/readiness — returns current score + pillar breakdown

- [ ] 19.3 Implement readiness explainability
    - Create ReadinessExplanation type with pillar details and contributing signals
    - API endpoint: GET /api/readiness/explain — full breakdown with signal attributions
    - Every point deducted or added traceable to a specific Capability and observation
    - Include trend data (improving/stable/declining per pillar)

- [ ] 19.4 Implement readiness history and trends
    - API endpoint: GET /api/readiness/history — score snapshots over time
    - Store 365 days of daily snapshots per household
    - Compute 7-day, 30-day, 90-day trend indicators
    - Detect seasonal patterns (optional, AI-enhanced later)

- [ ] 19.5 Write property tests for Readiness Engine
    - **Property 34: Pillar score is deterministic given same signals**
    - **Property 35: Overall readiness is weighted average of pillar scores**
    - **Property 36: Peace score derives from minimum pillar and volatility**
    - **Property 37: No signals implies no penalty (score = 100)**
    - **Property 38: Signal magnitude bounded to [-10, +10] clamps correctly**
    - Generate random signal sets; verify deterministic, bounded, explainable output

### 20. Finance Capability Signals

- [ ] 20.1 Define finance signal generators
    - Budget adherence signal: risk when >90% spent, opportunity when consistently under
    - Emergency fund signal: risk when <3 months expenses, positive when ≥6 months
    - Debt-to-income ratio signal: risk when >36%, warning when >28%
    - Cashflow forecast signal: risk when projected negative within 30 days
    - Net worth trend signal: positive when growing month-over-month
    - Recurring payment reliability signal: risk when missed payments detected

- [ ] 20.2 Wire existing finance services to emit signals
    - On budget recalculation → emit budget adherence signal
    - On account balance change → recalculate emergency fund and net worth signals
    - On cashflow projection → emit forecast signal
    - On debt change → emit debt-to-income signal
    - On recurring miss → emit reliability signal
    - Signals stored in DB and fed to Readiness Engine

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

- [ ] 22.2 Implement Morning Brief generation
    - API endpoint: GET /api/advisor/brief/morning
    - Contents: greeting, readiness score, today's priority, this week's events, top recommendation, current risk
    - Deterministic version (no AI): template-based using signals and timeline data
    - AI-enhanced version: natural language generated from same data (when Advisor available)
    - Fallback gracefully if AI unavailable — deterministic brief always works

- [ ] 22.3 Implement Weekly and Monthly Briefs
    - GET /api/advisor/brief/weekly — week in review + upcoming week
    - GET /api/advisor/brief/monthly — month summary, trends, readiness change, wins
    - Include: score changes, actions taken, recommendations completed, new risks

- [ ] 22.4 Implement recommendation prioritization
    - GET /api/advisor/recommendations — sorted by impact × urgency ÷ effort
    - Each recommendation links to its source Capability and signal
    - User can dismiss (won't resurface) or complete (improves readiness)
    - Track recommendation completion and resulting score changes

- [ ] 22.5 Implement cross-capability reasoning
    - Advisor has read access to signals from all active Capabilities simultaneously
    - Generate insights that span multiple domains:
      - "Insurance renewal + emergency fund level → safe to increase deductible"
      - "ARM adjustment in March + planned vacation → build extra buffer"
    - Store generated insights; deduplicate similar insights within 7 days

### 23. Household Timeline

- [ ] 23.1 Implement Timeline service and API
    - API endpoint: GET /api/timeline — unified chronological view
    - GET /api/timeline/upcoming — next 30 days of events from all Capabilities
    - GET /api/timeline/history — past events (what happened)
    - Each event: title, date, capability source, actionRequired flag, status

- [ ] 23.2 Wire finance events into Timeline
    - Recurring bills → upcoming timeline events
    - Payday → upcoming event
    - Goal milestones → past/upcoming events
    - Budget period start/end → recurring events
    - Debt payoff milestones → upcoming events

- [ ] 23.3 Implement Timeline UI
    - Scrollable vertical timeline: past ← today → future
    - Color-coded by Capability source
    - Action-required events highlighted
    - Click event → navigate to relevant Capability view
    - Mobile-friendly: swipeable, compact cards

### 24. Readiness Dashboard & Brief UI

- [ ] 24.1 Implement Readiness dashboard (replaces old dashboard)
    - Hero: overall readiness score (large number) + trend indicator
    - Pillar breakdown: 5 progress bars with scores and status labels
    - Top risk card: biggest current risk with recommendation
    - Top opportunity card: highest-impact action available
    - Recent score changes: what moved the needle this week

- [ ] 24.2 Implement Morning Brief UI (new home screen)
    - Greeting with readiness score
    - Today's priorities (from Advisor)
    - This week's timeline events
    - Top recommendation with one-tap actions
    - Active risks summary
    - This becomes the landing page after login

- [ ] 24.3 Implement Advisor conversation UI (replaces AI Chat)
    - Rebrand from "AI Chat" to "Advisor"
    - Advisor context includes readiness state and signals
    - Responses include inline readiness references ("This affects your Provision score")
    - Quick actions: "Explain my score", "What should I prioritize?", "What if I lose my job?"

- [ ] 24.4 Implement Timeline UI page
    - Full-page scrollable timeline
    - Filter by Capability, by pillar, by action-required
    - Past events show completion status
    - Future events show countdown/proximity

### 25. Phase 2 Checkpoint

- [ ] 25.1 Verify Readiness Engine produces correct, explainable scores
- [ ] 25.2 Verify Morning Brief renders with real finance data
- [ ] 25.3 Verify Timeline shows upcoming bills, paydays, and milestones
- [ ] 25.4 Verify Advisor can explain readiness changes
- [ ] 25.5 All property tests pass (Properties 34–38+)
- [ ] 25.6 Docker Compose stack works with new features
- [ ] 25.7 Demo instance updated with readiness data

---

## Phase 3 — Household Platform [FUTURE]

> Goal: Expand beyond finance. Add Capabilities for other household domains. Each new Capability plugs into the same pipeline without modifying the Readiness Engine.

### 26. Additional Capabilities

- [ ] 26.1 Vehicle Capability
    - Track vehicles: make, model, year, mileage
    - Maintenance schedules (oil change, tires, registration, inspection)
    - Signals: overdue maintenance → risk, upcoming registration → timeline event
    - Pillar: Preparation

- [ ] 26.2 Insurance Capability
    - Track policies: type, provider, premium, deductible, coverage, renewal date
    - Signals: renewal approaching → timeline + recommendation, coverage gap → risk
    - Cross-capability: correlate deductible with emergency fund
    - Pillar: Protection

- [ ] 26.3 Home Maintenance Capability
    - Track appliances: type, age, expected lifespan, replacement cost
    - Maintenance tasks: HVAC filter, gutter cleaning, roof inspection
    - Signals: appliance nearing end-of-life → risk + sinking fund recommendation
    - Pillar: Preparation

- [ ] 26.4 Estate Capability
    - Track: will status, beneficiaries, document locations, power of attorney
    - Signals: no will → critical risk, outdated beneficiaries → warning
    - Pillar: Protection

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

### 33. Income & Spending Intelligence

- [ ] 33.1 Income configuration and pay schedule
    - Pay frequency: semi-monthly, biweekly, monthly, custom
    - Expected net per paycheck
    - Salary vs hourly tracking
    - Dashboard: "Next paycheck: ~[date]"

- [ ] 33.2 Spending trends and monthly comparisons
    - Month-over-month category spending comparison
    - Income vs expenses and savings rate
    - Per-category change indicators
    - 6/12-month trend visualizations

- [ ] 33.3 Spending pace line visualization
    - Cumulative daily spending vs ideal pace line
    - Under/over pace indicator with dollar amount
    - Show on dashboard and budget detail

### 34. Transaction Workflow

- [ ] 34.1 Transaction review/inbox workflow
    - `reviewed` boolean field (bank imports start unreviewed)
    - "Mark as Reviewed" action (single and bulk)
    - Unreviewed count badge in navigation
    - Filter for unreviewed transactions

- [ ] 34.2 Tags support
    - Tag model with many-to-many relation to transactions
    - CRUD endpoints, tag filter in search
    - Rules engine can auto-apply tags
    - Tag management UI

- [ ] 34.3 Refund matching
    - Detect credits from same merchant within 90 days
    - Show matched pair for user confirmation
    - Confirmed refunds excluded from spending totals

### 35. Budgeting Enhancements

- [ ] 35.1 Budget rollovers
    - Track unspent per category at month end
    - Roll forward to next month automatically
    - Show rollover amount separately in UI
    - Per-category opt-in/out

- [ ] 35.2 Subscription management view
    - Dedicated /subscriptions page
    - Group by: active, upcoming, annual renewals
    - Total monthly subscription burn rate
    - Alert on cancelled subscription still charging

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

---

---

## Scenario Modeling [Phase 2+]

> "What happens to my readiness if...?" — the ultimate preparedness question.

### 38. What-If Engine

- [ ] 38.1 Implement scenario readiness computation
    - Accept hypothetical signal changes (lose job, buy house, pay off debt)
    - Recompute all pillar scores with modified signals
    - Show projected readiness trajectory over time
    - API endpoint: POST /api/readiness/scenario

- [ ] 38.2 Implement scenario UI
    - "What if" panel with common scenarios as presets
    - Custom scenario builder (adjust income, add expense, remove account)
    - Side-by-side: current readiness vs projected
    - Advisor explains implications of each scenario

---

## AI Memory & Proactive Intelligence [Phase 2+]

> The Advisor remembers. It learns patterns, anticipates needs, and surfaces insights before you ask.

### 39. AI Memory

- [ ] 39.1 Implement Advisor memory system
    - Store learned patterns: seasonal spending, annual events, user preferences
    - Reference past context: "Last year you spent ~$900 on Christmas"
    - Track recommendation outcomes: which advice was followed, what happened after
    - Memory is per-household, stored locally, never sent to cloud

### 40. Proactive Intelligence

- [ ] 40.1 Implement proactive daily briefing generation
    - Worker job (configurable time) generates personalized briefing
    - Detects: unusual charges, budgets running hot, spending shifts
    - Suggests: recategorizations, savings opportunities, risk mitigations
    - Each suggestion actionable with one-tap approve/dismiss
    - Advisor learns from dismissed suggestions to reduce noise

---

## Notes

- Tasks from Phase 1 marked `[x]` are fully implemented and deployed.
- Phase 2 is the immediate priority — this is what makes Wardkeep a decision engine.
- Phases 3–6 are documented for architectural alignment but not scheduled.
- "Ongoing Enhancements" can be interleaved with Phase 2 based on user demand.
- Every new Capability (Phase 3+) automatically benefits from the Readiness Engine and Advisor built in Phase 2.
- The Readiness Engine is deterministic. The Advisor is AI-powered. They are architecturally separate.
- Property tests continue to validate correctness. New properties (34+) cover Readiness Engine invariants.
- The terminology in this document follows `/docs/terminology.md`. Code, UI, and docs should match.
