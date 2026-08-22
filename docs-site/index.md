---
layout: home
title: Home
nav_order: 1
permalink: /
---

# Wardkeep
{: .fs-9 }

Guard your ground.
{: .fs-6 .fw-300 }

A private, self-hostable household-readiness platform. Wardkeep starts with finance—spending, income, debt, savings, bills, subscriptions, and cash flow—and is becoming the command center for what your household needs to prepare for next.
{: .fs-5 .fw-300 }

[Get Started]({{ site.baseurl }}/quick-start){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Self-Host Now]({{ site.baseurl }}/deployment){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## The key difference

Instead of only showing numbers, Wardkeep **explains** what is happening, **shows how complete that picture is**, **anticipates** what is coming, and **recommends** actions—all while keeping your data private.

AI is never the source of truth. Deterministic math handles balances, forecasts, debt calculations, and budgets. AI explains, categorizes, summarizes, detects patterns, and suggests actions.

### Household readiness

Wardkeep’s emerging home experience is a household-readiness command center. It separates **readiness** (how prepared the observed information indicates you are) from **coverage** (how much Wardkeep has actually evaluated). Missing data is never treated as proof that everything is fine.

The current foundation includes deterministic finance signals, a graduated liquid-reserve assessment, readiness history, coverage indicators, and truthful spending/budget pacing. Composite insurance, estate, home, vehicle, timeline, scenarios, and recommendation impact previews are the next layers—not claims the current score already makes.

---

## Features

### Bank auto-import
{: .d-inline-block }
SimpleFIN
{: .label .label-green }

Connect your bank accounts and auto-import transactions. Supports most US banks through SimpleFIN Bridge.

### AI chat assistant

Ask natural-language questions about your finances. Runs locally via Ollama or through OpenAI/Anthropic cloud APIs. Your choice.

### Privacy modes

| Mode | Behavior |
|:-----|:---------|
| LOCAL | All AI via Ollama. Zero external network calls. |
| HYBRID | Sensitive data stays local. General queries can use cloud. |
| CLOUD | All AI via OpenAI/Anthropic. Fast, no local resources. |

### Monthly budgets

Set category allocations, track progress with visual indicators, and get alerts when you're overspending.

### Debt payoff calculator

Model snowball, avalanche, consolidation, and velocity banking strategies. Compare month-by-month schedules side-by-side.

### Cash-flow forecast

90-day projection based on recurring transactions. See what's coming before it arrives.

### Readiness coverage

See the household-readiness score alongside its coverage, contributing finance signals, trend, areas needing attention, and recommended next steps. An unevaluated pillar is shown as unknown rather than perfect.

### CSV / OFX / QFX import

Bring your transaction history from any bank. Column mapping and preview before committing.

### Encrypted backups

AES-256-GCM encryption with your passphrase. Scheduled or on-demand. Your data, your key.

### PWA / Offline

Installable on any device. Works offline with background sync when connectivity returns.

### Self-hosted

Single-command Docker Compose deployment. Pre-built images on GitHub Container Registry. No cloud account required.

---

## Tech stack

| Layer | Technology |
|:------|:-----------|
| Frontend | Next.js 14 / React 18 / TypeScript / Tailwind CSS |
| Backend | NestJS 10 / TypeScript / Prisma 5 / SWC |
| Database | PostgreSQL 16 — NUMERIC(19,4) for currency |
| Queue | Redis 7 / BullMQ |
| AI | Ollama (local) + OpenAI / Anthropic (optional cloud) |
| Bank Sync | SimpleFIN |
| Deployment | Docker Compose / GHCR images |
| Monorepo | Turborepo + pnpm workspaces |

---

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/reyvera/wardkeep/main/install.sh | bash
```

Downloads the compose file, generates secure credentials, pulls pre-built images, and starts the app. Done in under 2 minutes.

[Full deployment guide]({{ site.baseurl }}/deployment){: .btn .btn-outline }
[Roadmap]({{ site.baseurl }}/roadmap){: .btn .btn-outline }

---

## Screenshots

> Screenshots are refreshed periodically and may show an earlier financial-overview layout. The current product direction and readiness contract are documented in the repository’s [Readiness Engine specification](https://github.com/reyvera/wardkeep/blob/main/docs/readiness-engine.md).

![Dashboard]({{ site.baseurl }}/assets/screenshots/desktop/dashboard.png?v={{ site.time | date: '%s' }})

[View all screenshots]({{ site.baseurl }}/screenshots){: .btn .btn-outline }

---

## License

Wardkeep is open source under [AGPL-3.0](https://github.com/reyvera/wardkeep/blob/main/LICENSE). Self-host it, modify it, contribute back.
