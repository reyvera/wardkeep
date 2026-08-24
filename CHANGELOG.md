# Changelog

All notable changes to Wardkeep will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Truthful readiness history** — The Dashboard now receives up to 90 daily readiness snapshots and labels its score movement with the actual available time span.
- **Spending-pace color meaning** — The Financial Overview spending curve is now green only when under pace, amber near pace, and red when over pace or when recent spending is accelerating above the daily budget pace.
- **Safe database upgrades** — Application images now apply only checked-in Prisma migrations and refuse to start on a migration failure. They no longer fall back to destructive schema synchronization or seed data during an update.
- **Release versioning** — The workspace is aligned to 2.1.1, with a release guard that rejects mismatched `vX.Y.Z` tags.
- **Development images** — Pushes to `develop` now publish separate `develop` and commit-specific Docker images, keeping development deployment tags distinct from releases.

### Added

- **Readiness comparison windows** — The Dashboard now shows available short-, medium-, and longer-term readiness changes using the actual recorded time span.
- **Readiness explanation API** — `GET /api/readiness/explain` now provides a read-only explanation of each pillar’s evaluated signals, not-yet-evaluated factors, freshness, and recorded score changes.
- **Longer spending trends** — Financial Overview can now switch its income-versus-expenses chart between six and twelve months.
- **Budget spending pace** — Budget now shows the recorded month-end spending projection and the amount over or under the elapsed-day budget pace, instead of treating all unspent allocation as automatically under budget.
- **Household Timeline** — A single, chronological view now brings together recorded recurring bills, policy renewals, expected income dates, and planned expenses for the next 30, 90, or 365 days, with direct links back to each source record.
- **Verified migration baseline** — Existing development databases without Prisma history can be explicitly baselined only after a strict schema match, preserving household data while enabling normal future upgrades.
- **Readiness coverage** — The readiness API and dashboard now expose how much of the household picture Wardkeep has evaluated. Pillars show their evaluated coverage and confidence rather than implying complete knowledge.
- **Readiness command-center dashboard** — Household readiness now includes a trend, explainable pillar gateways, a Needs attention section, and action-oriented recommendations.
- **Capability-specific next actions** — Dashboard risks and recommendations now link directly to the relevant accounts, policies, budget, cash-flow, recurring-bills, debt, or readiness-factor workflow.
- **Actual spending-pace data** — Transaction statistics now return cumulative daily spending for truthful pacing charts.
- **Insurance policies** — Record policy type, provider, premium frequency, deductible, coverage amount, renewal date, and whether payments are separate or bundled into a mortgage, loan, lease, or another account.
- **Protection insurance signals** — Protection can flag upcoming or overdue recorded renewals and warn when recorded deductibles exceed liquid reserves, without claiming insurance adequacy.
- **Policy dashboard summary** — The Dashboard and Protection detail page now surface active policy count, renewals needing attention, incomplete records, and a direct Policies action.
- **Mortgage escrow estimate** — Home policies can show the combined monthly insurance and property-tax escrow component, clearly identified as included in the linked mortgage payment.
- **Policy notes** — Policies can retain renewal instructions, document locations, and other household context.
- **Estate-planning reminders** — Record planning document types and optional review dates without storing document contents. Protection can surface an overdue or upcoming review, while explicitly avoiding legal-validity or adequacy claims.
- **Income-source context** — Record expected income frequency, optional net amount, and review timing. These records support planning reminders without predicting income continuity or job security.
- **Visible secondary liquidity** — Credit-card accounts can record a credit limit and show available borrowing capacity, clearly separated from cash reserves.
- **Low available-credit warning** — A recorded card that is at least 90% used can surface a modest Protection warning, without treating credit as readiness credit.
- **Recorded fixed-obligation warning** — Protection can flag when recorded monthly debt minimums exceed liquid reserves, without assuming unrecorded household bills.
- **Dependent planning reminders** — Optional non-identifying household records can carry a review date, without assessing care needs or coverage adequacy.
- **Recorded income dates** — Income-source records can include a next expected date, shown in Dashboard Coming Up without predicting a paycheck.
- **Planned-expense funding** — Record a known future cost, due date, and funds explicitly set aside; upcoming shortfalls appear in Preparation and Coming Up.

### Changed

- **Direct-pillar dashboard summary** — “Strongest observed” and “most limited observed” now compare only directly evaluated pillars; derived Peace is no longer presented as an independently observed weakness.
- **Peace respects missing evidence** — The derived Peace score now uses only pillars with observed signals, so an unevaluated pillar does not force Peace to 0%.
- **Exact budget allocations are on budget** — A category spent exactly to its allocation is now shown as a warning-level fully used category, not counted as overspent in Provision or recommendations.
- **Unknown is no longer healthy** — An unevaluated pillar is not scored as 100. Preparation is currently explicitly unevaluated because no generator exists.
- **Protection liquidity score is graduated** — Liquid reserves progress continuously from 0 through 12 months of ordinary expenses instead of treating 3 and 12 months as equally protected.
- **Protection burn rate excludes common transfer-like debits** — Transfer, credit-card payment, investment, savings-transfer, and principal-payment descriptors no longer automatically inflate ordinary household expense estimates.
- **Credit-card payment matching** — An equal checking or savings debit and household credit-card credit within three days are treated as one internal payment, preventing duplicate burn-rate spending without removing unmatched transactions.
- **One-time expense control** — Transactions can be visibly marked one-time to exclude only that user-designated debit from recurring Protection burn-rate calculations.
- **Truthful freshness status** — Manual accounts are no longer labeled stale based on record age; only overdue or never-completed connected-account syncs qualify readiness confidence for review.
- **Factor evidence states** — Pillar factors now identify whether their evidence is synchronized, manual, mixed, stale, calculated, or unknown alongside their sources, method, and limitation.
- **Durable recommendations foundation** — Risk and warning signals now create stable, source-linked recommendation records with deterministic priority, action links, assumptions, and completed/dismissed/resolved state.
- **Actionable recommendation dashboard** — The Dashboard now shows active durable recommendations with direct workflow links and controls to complete or dismiss each action.
- **Recommendation history** — A dedicated Recommendations page keeps active actions and completed, dismissed, or automatically resolved history visible and reviewable.
- **Current recommendation workspace** — Opening Recommendations refreshes readiness before loading actions, so the list reflects current signals rather than a prior dashboard visit.
- **Qualified recommendation impact previews** — When a source risk can be removed while other pillar factors remain, Wardkeep shows the resulting pillar-only score estimate; otherwise it states that the change will be measured after records update.
- **Coming Up** — The Dashboard now lists recorded recurring-payment dates and policy renewals in the next 30 days, with direct links to the source workflow.
- **Budget pacing is truthful mid-month** — Financial Overview reports remaining budget, pace against the expected date, and projected month-end spending rather than calling all unspent allocation “under budget.”
- **Reversible policy lifecycle** — Cancelled or replaced policies can be marked inactive and restored later; inactive policies do not affect current readiness signals.

### Infrastructure

- **Docs-site validation** — CI now builds the GitHub Pages site on pull requests and pushes, and Pages redeploys when documentation, screenshots, or the README change. Documentation dependencies are locked and enforced in CI.

## [1.2.0] - 2026-08-20

### Added

- **Uncategorized Transactions Filter** — Category filter dropdown on the Transactions page now includes an "Uncategorized" option to show only transactions without an assigned category.
- **Debt Consolidation Calculator** — Model refinancing all debts into a single fixed-rate loan. Enter APR, term, and origination fee to see monthly payment, total cost, and savings vs. minimum-only baseline.
- **Velocity Banking Calculator** — HELOC chunking strategy that uses a line of credit to make lump-sum payments against highest-rate debt, then pays down the HELOC with disposable income. Shows combined interest cost and comparison to baseline.
- **Minimum-Only Baseline** — Calculate how long debt takes to pay off with only minimum payments. Serves as the comparison benchmark for all other strategies.
- **Improved Debt Schedule Display** — Month-by-month consolidated view showing all debts per month simultaneously. Includes per-debt summary cards, month totals, "Paid Off" status indicators, and configurable time horizon (12/24/60/all months).

### Changed

- Debt payoff schedule table now groups entries by month (previously listed all months per debt sequentially, making it appear debts were paid one-at-a-time rather than simultaneously).

### API

- `POST /api/debt/consolidation` — Debt consolidation scenario calculator
- `POST /api/debt/velocity-banking` — Velocity banking (HELOC chunking) calculator
- `POST /api/debt/minimum-only` — Minimum-payment-only baseline calculator

## [1.0.0] - 2026-07-06

### Added

- **Accounts** — Checking, savings, credit cards, loans, mortgage, cash
- **Transactions** — Full CRUD, search, duplicate detection, bulk import
- **Bank Sync** — Auto-import transactions via SimpleFIN (supports most US banks)
- **CSV/OFX/QFX Import** — Column mapping and preview before commit
- **Categories** — Hierarchical categories with icons, colors, and AI auto-categorization
- **Monthly Budgets** — Category allocations with progress tracking and alerts
- **Rules Engine** — Auto-categorize by merchant, amount, description (with dry-run)
- **AI Chat** — Natural-language finance assistant (OpenAI, Anthropic, or local Ollama)
- **AI Categorization** — Background auto-categorization with confidence scoring
- **Debt Payoff Calculator** — Snowball, avalanche, custom strategies with what-if mode
- **Cash-Flow Forecast** — 90-day projection based on recurring transactions
- **Recurring Detection** — Automatic detection of recurring bills and subscriptions
- **Encrypted Backups** — AES-256-GCM with user passphrase, scheduled or on-demand
- **Settings** — Per-user AI mode, session timeout, backup schedule
- **PWA** — Offline support, installable on any device, background sync
- **Notifications** — Real-time WebSocket notifications for budget alerts
- **Docker Deployment** — Single-command self-hosted deployment with health checks
- **Demo Mode** — Lightweight deployment with sample data for evaluation

### Security

- Session-based auth with configurable timeout and auto-lockout
- Per-user data isolation enforced at query layer
- AES-256 encryption for API keys and bank tokens at rest
- Rate limiting on all auth endpoints
- Startup refuses default encryption key in production mode

### Infrastructure

- Multi-stage Docker builds (node:22-alpine)
- GitHub Actions CI/CD for multi-arch image publishing (amd64 + arm64)
- One-liner install script for self-hosting
- Pre-built images on GitHub Container Registry
- Prisma migrations auto-applied on startup
