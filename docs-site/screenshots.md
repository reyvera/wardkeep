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

Net worth, spending breakdown, savings projections, and recent activity at a glance.

![Dashboard — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/dashboard.png)

---

### Transactions

Search, filter by category/date/account, and bulk-manage transactions.

![Transactions — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/transactions.png)

---

### Budget

Monthly allocations per category with progress bars and overspend alerts.

![Budget — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/budget.png)

---

### AI Chat

Ask natural-language questions about your finances. Runs locally or via cloud APIs.

![AI Chat — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/chat.png)

---

### Debt Payoff

Snowball, avalanche, consolidation, and velocity banking calculators with month-by-month schedules.

![Debt Payoff — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/debt.png)

---

### Accounts

All your accounts in one view — checking, savings, credit cards, loans, cash.

![Accounts — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/accounts.png)

---

### Categories

Hierarchical categories with icons, colors, and AI auto-categorization.

![Categories — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/categories.png)

---

### Bank Connections

Connect your bank via SimpleFIN and sync transactions automatically.

![Bank Connections — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/bank-connections.png)

---

### Import

CSV, OFX, and QFX import with column mapping and preview.

![Import — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/import.png)

---

### Recurring Transactions

Auto-detected recurring bills and subscriptions.

![Recurring — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/recurring.png)

---

### Rules Engine

Automatic categorization based on merchant, amount, or description.

![Rules — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/rules.png)

---

### Settings

Per-user AI mode, session timeout, backup schedule, and encryption keys.

![Settings — Desktop]({{ site.baseurl }}/assets/screenshots/desktop/settings.png)

---

## Mobile

Fully responsive PWA. Installable on any device.
{: .fs-5 .fw-300 }

| Dashboard | Transactions | Budget |
|:---------:|:------------:|:------:|
| ![Dashboard]({{ site.baseurl }}/assets/screenshots/mobile/dashboard.png) | ![Transactions]({{ site.baseurl }}/assets/screenshots/mobile/transactions.png) | ![Budget]({{ site.baseurl }}/assets/screenshots/mobile/budget.png) |

| AI Chat | Debt Payoff | Accounts |
|:-------:|:-----------:|:--------:|
| ![Chat]({{ site.baseurl }}/assets/screenshots/mobile/chat.png) | ![Debt]({{ site.baseurl }}/assets/screenshots/mobile/debt.png) | ![Accounts]({{ site.baseurl }}/assets/screenshots/mobile/accounts.png) |

| Categories | Bank Connections | Import |
|:----------:|:----------------:|:------:|
| ![Categories]({{ site.baseurl }}/assets/screenshots/mobile/categories.png) | ![Bank Connections]({{ site.baseurl }}/assets/screenshots/mobile/bank-connections.png) | ![Import]({{ site.baseurl }}/assets/screenshots/mobile/import.png) |

| Recurring | Rules | Settings |
|:---------:|:-----:|:--------:|
| ![Recurring]({{ site.baseurl }}/assets/screenshots/mobile/recurring.png) | ![Rules]({{ site.baseurl }}/assets/screenshots/mobile/rules.png) | ![Settings]({{ site.baseurl }}/assets/screenshots/mobile/settings.png) |

---

## Regenerating screenshots

Screenshots are auto-captured with Playwright against the demo user's data:

```bash
# Prerequisites: dev servers running, demo user seeded
npx playwright install chromium   # one-time
pnpm screenshots
```

Output lands in `docs/screenshots/{desktop,mobile}/*.png`.
