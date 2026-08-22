---
layout: default
title: Screenshots
nav_order: 4
permalink: /screenshots
---

# Screenshots
{: .fs-9 }

See Wardkeep in action — desktop and mobile.
{: .fs-6 .fw-300 }

---

## Desktop

### Dashboard

Household readiness, coverage, explainable pillar signals, areas needing attention, and recommended next steps.

![Dashboard — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/dashboard.png?v={{ site.time | date: '%s' }})

---

### Transactions

Search, filter by category/date/account, and bulk-manage transactions.

![Transactions — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/transactions.png?v={{ site.time | date: '%s' }})

---

### Budget

Monthly allocations per category with progress bars and overspend alerts.

![Budget — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/budget.png?v={{ site.time | date: '%s' }})

---

### AI Chat

Ask natural-language questions about your finances. Runs locally or via cloud APIs.

![AI Chat — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/chat.png?v={{ site.time | date: '%s' }})

---

### Debt Payoff

Snowball, avalanche, consolidation, and velocity banking calculators with month-by-month schedules.

![Debt Payoff — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/debt.png?v={{ site.time | date: '%s' }})

---

### Accounts

All your accounts in one view — checking, savings, credit cards, loans, cash.

![Accounts — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/accounts.png?v={{ site.time | date: '%s' }})

---

### Categories

Hierarchical categories with icons, colors, and AI auto-categorization.

![Categories — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/categories.png?v={{ site.time | date: '%s' }})

---

### Bank Connections

Connect your bank via SimpleFIN and sync transactions automatically.

![Bank Connections — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/bank-connections.png?v={{ site.time | date: '%s' }})

---

### Import

CSV, OFX, and QFX import with column mapping and preview.

![Import — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/import.png?v={{ site.time | date: '%s' }})

---

### Recurring Transactions

Auto-detected recurring bills and subscriptions.

![Recurring — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/recurring.png?v={{ site.time | date: '%s' }})

---

### Rules Engine

Automatic categorization based on merchant, amount, or description.

![Rules — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/rules.png?v={{ site.time | date: '%s' }})

---

### Settings

Per-user AI mode, session timeout, backup schedule, and encryption keys.

![Settings — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/settings.png?v={{ site.time | date: '%s' }})

---

## Mobile

Fully responsive PWA. Installable on any device.
{: .fs-5 .fw-300 }

| Dashboard | Transactions | Budget |
|:---------:|:------------:|:------:|
| ![Dashboard]({{ site.baseurl }}/assets/screenshots/mobile/dashboard.png?v={{ site.time | date: '%s' }}) | ![Transactions]({{ site.baseurl }}/assets/screenshots/mobile/transactions.png?v={{ site.time | date: '%s' }}) | ![Budget]({{ site.baseurl }}/assets/screenshots/mobile/budget.png?v={{ site.time | date: '%s' }}) |

| AI Chat | Debt Payoff | Accounts |
|:-------:|:-----------:|:--------:|
| ![Chat]({{ site.baseurl }}/assets/screenshots/mobile/chat.png?v={{ site.time | date: '%s' }}) | ![Debt]({{ site.baseurl }}/assets/screenshots/mobile/debt.png?v={{ site.time | date: '%s' }}) | ![Accounts]({{ site.baseurl }}/assets/screenshots/mobile/accounts.png?v={{ site.time | date: '%s' }}) |

| Categories | Bank Connections | Import |
|:----------:|:----------------:|:------:|
| ![Categories]({{ site.baseurl }}/assets/screenshots/mobile/categories.png?v={{ site.time | date: '%s' }}) | ![Bank Connections]({{ site.baseurl }}/assets/screenshots/mobile/bank-connections.png?v={{ site.time | date: '%s' }}) | ![Import]({{ site.baseurl }}/assets/screenshots/mobile/import.png?v={{ site.time | date: '%s' }}) |

| Recurring | Rules | Settings |
|:---------:|:-----:|:--------:|
| ![Recurring]({{ site.baseurl }}/assets/screenshots/mobile/recurring.png?v={{ site.time | date: '%s' }}) | ![Rules]({{ site.baseurl }}/assets/screenshots/mobile/rules.png?v={{ site.time | date: '%s' }}) | ![Settings]({{ site.baseurl }}/assets/screenshots/mobile/settings.png?v={{ site.time | date: '%s' }}) |

---

## Regenerating screenshots

Screenshots are auto-captured with Playwright against the demo user's data:

```bash
# Prerequisites: dev servers running, demo user seeded
npx playwright install chromium   # one-time
pnpm screenshots
```

Output lands in `docs/screenshots/{desktop,mobile}/*.png`.
