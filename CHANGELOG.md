# Changelog

All notable changes to Wardkeep will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
