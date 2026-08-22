---
layout: default
title: Screenshots
nav_order: 4
permalink: /screenshots
---

# Wardkeep, in your hands.
{: .fs-9 }

The actual product, shown across desktop, tablet, and mobile.
{: .fs-6 .fw-300 }

<div class="screenshot-gallery">

## Dashboard

Household readiness, coverage, explainable pillar signals, areas needing attention, and recommended next steps.

<div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/dashboard.png?v={{ site.time | date: '%s' }}" alt="Wardkeep dashboard in a MacBook frame"></div>

## Everyday money, clearly organized

<div class="screenshot-pair">
  <div><h3>Transactions</h3><p>Search, filter by category, date, or account, and manage your activity in one place.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/transactions.png?v={{ site.time | date: '%s' }}" alt="Transactions in a MacBook frame"></div></div>
  <div><h3>Budget</h3><p>Monthly category allocations, progress, and overspend alerts—based on actual spending.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/budget.png?v={{ site.time | date: '%s' }}" alt="Budget in a MacBook frame"></div></div>
</div>

<div class="screenshot-pair">
  <div><h3>Accounts</h3><p>Checking, savings, credit cards, loans, and cash in one household view.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/accounts.png?v={{ site.time | date: '%s' }}" alt="Accounts in a MacBook frame"></div></div>
  <div><h3>Debt payoff</h3><p>Compare snowball, avalanche, consolidation, and custom payoff strategies.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/debt.png?v={{ site.time | date: '%s' }}" alt="Debt payoff in a MacBook frame"></div></div>
</div>

## Connected and ready for real life

<div class="screenshot-pair">
  <div><h3>Bank connections</h3><p>Connect through SimpleFIN and bring your financial picture together.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/bank-connections.png?v={{ site.time | date: '%s' }}" alt="Bank connections in a MacBook frame"></div></div>
  <div><h3>Recurring bills</h3><p>Recognize subscriptions and recurring payments before they surprise you.</p><div class="device-macbook"><img src="{{ site.baseurl }}/assets/screenshots/desktop/recurring.png?v={{ site.time | date: '%s' }}" alt="Recurring payments in a MacBook frame"></div></div>
</div>

## Mobile, when you are away from your desk

<div class="phone-grid">
  <div class="device-phone"><img src="{{ site.baseurl }}/assets/screenshots/mobile/dashboard.png?v={{ site.time | date: '%s' }}" alt="Mobile dashboard"></div>
  <div class="device-phone"><img src="{{ site.baseurl }}/assets/screenshots/mobile/transactions.png?v={{ site.time | date: '%s' }}" alt="Mobile transactions"></div>
  <div class="device-phone"><img src="{{ site.baseurl }}/assets/screenshots/mobile/budget.png?v={{ site.time | date: '%s' }}" alt="Mobile budget"></div>
  <div class="device-phone"><img src="{{ site.baseurl }}/assets/screenshots/mobile/chat.png?v={{ site.time | date: '%s' }}" alt="Mobile chat"></div>
</div>

</div>

## Regenerating screenshots

Screenshots are captured with Playwright against demo data:

```bash
# Prerequisites: dev servers running, demo user seeded
npx playwright install chromium   # one-time
pnpm screenshots
```

Output lands in `docs/screenshots/{desktop,mobile}/*.png` and is published by the GitHub Pages workflow.
