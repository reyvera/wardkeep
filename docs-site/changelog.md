---
layout: default
title: Changelog
nav_order: 5
permalink: /changelog
---

# Changelog

{: .fs-9 }

All notable changes to Wardkeep.
{: .fs-6 .fw-300 }

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Insurance policies** — Record policy details, renewal dates, deductibles, coverage amounts, and whether payments are separate or bundled into a mortgage, loan, lease, or another account.
- **Protection insurance signals** — Wardkeep can flag upcoming or overdue recorded renewals and compare recorded deductibles with liquid reserves. These are explainable records checks, not insurance-adequacy advice.
- **Policy dashboard summary** — The Dashboard and Protection page show policy attention and incomplete records with a direct Policies action.
- **Mortgage escrow estimate** — Home policies can show the recorded insurance and property-tax escrow component of a linked mortgage payment.
- **Policy notes** — Policies can retain renewal instructions, document locations, and other household context.
- **Estate-planning reminders** — Record planning document types and review dates without storing document contents. Protection can remind about a recorded review date without making legal-validity or adequacy claims.
- **Income-source context** — Record expected income frequency, optional net amount, and review timing without predicting income continuity or job security.
- **Capability-specific next actions** — Dashboard risks and recommendations link directly to the related household workflow instead of stopping at static advice.
- **Credit-card payment matching** — Matching household card-payment pairs no longer double-count as ordinary spending in Protection’s burn-rate calculation.
- **One-time expense control** — A household can visibly mark a debit as one-time to exclude only that user-designated transaction from recurring Protection burn-rate calculations.
- **Truthful freshness status** — Manual accounts are reported as manual data rather than stale connected data; only overdue or never-completed bank syncs require a readiness freshness review.
- **Factor evidence states** — Each pillar factor now identifies the state of its evidence alongside its sources, method, and limitation.
- **Durable recommendations foundation** — Risk and warning signals now create source-linked recommendation records with deterministic priority, action links, assumptions, and completed/dismissed/resolved state.
- **Actionable recommendation dashboard** — The Dashboard now shows active durable recommendations with direct workflow links and controls to complete or dismiss each action.
- **Recommendation history** — A dedicated Recommendations page keeps active actions and completed, dismissed, or automatically resolved history visible and reviewable.
- **Current recommendation workspace** — Opening Recommendations refreshes readiness before loading actions, so the list reflects current signals rather than a prior dashboard visit.
- **Qualified recommendation impact previews** — When a source risk can be removed while other pillar factors remain, Wardkeep shows the resulting pillar-only score estimate; otherwise it states that the change will be measured after records update.
- **Coming Up** — The Dashboard now lists recorded recurring-payment dates and policy renewals in the next 30 days, with direct links to the source workflow.

### Changed

- **Direct-pillar dashboard summary** — The Dashboard now compares only directly evaluated pillars when naming the strongest and most limited observed area.
- **Peace respects missing evidence** — Derived Peace now uses only pillars with observed signals rather than treating an unevaluated pillar as zero.
- **Exact budget allocations are on budget** — A category spent exactly to its allocation is now shown as fully used rather than overspent in Provision and recommendations.
- **Policy lifecycle** — Cancelled or replaced policies can be marked inactive and later restored. Inactive policies do not affect current readiness signals.
- **Documentation delivery** — CI validates the Pages site before merge; the public site redeploys when documentation, screenshots, or the README change.

---

## [1.2.0] — 2026-08-20

### Added

- **Uncategorized Transactions Filter** — Category filter dropdown on the Transactions page now includes an "Uncategorized" option to show only transactions without an assigned category.
- **Debt Consolidation Calculator** — Model refinancing all debts into a single fixed-rate loan. Enter APR, term, and origination fee to see monthly payment, total cost, and savings vs. minimum-only baseline.
- **Velocity Banking Calculator** — HELOC chunking strategy that uses a line of credit to make lump-sum payments against highest-rate debt, then pays down the HELOC with disposable income. Shows combined interest cost and comparison to baseline.
- **Minimum-Only Baseline** — Calculate how long debt takes to pay off with only minimum payments. Serves as the comparison benchmark for all other strategies.
- **Improved Debt Schedule Display** — Month-by-month consolidated view showing all debts per month simultaneously. Includes per-debt summary cards, month totals, "Paid Off" status indicators, and configurable time horizon (12/24/60/all months).

### Changed

- Debt payoff schedule table now groups entries by month (previously listed all months per debt sequentially, making it appear debts were paid one-at-a-time rather than simultaneously).

### New API endpoints

| Endpoint                          | Description                                  |
| :-------------------------------- | :------------------------------------------- |
| `POST /api/debt/consolidation`    | Debt consolidation scenario calculator       |
| `POST /api/debt/velocity-banking` | Velocity banking (HELOC chunking) calculator |
| `POST /api/debt/minimum-only`     | Minimum-payment-only baseline calculator     |

---

## [1.0.0] — 2026-07-06

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
- GitHub Actions CI/CD for image publishing (amd64 + arm64)
- One-liner install script for self-hosting
- Pre-built images on GitHub Container Registry
- Prisma migrations auto-applied on startup
