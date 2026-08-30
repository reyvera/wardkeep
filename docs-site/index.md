---
layout: home
title: Wardkeep
nav_order: 1
permalink: /
---

<section class="wardkeep-hero">
  <div>
    <p class="wardkeep-eyebrow">Private household command center</p>
    <h1>Guard your ground.<br>Know what your household needs next.</h1>
    <p class="wardkeep-hero-copy">Connect your finances, obligations, assets, and household information. Wardkeep explains where you stand, identifies what needs attention, and helps you prepare for what comes next.</p>
    <div class="wardkeep-actions">
      <a class="btn btn-primary" href="{{ site.baseurl }}/quick-start">Start your private command center</a>
      <a class="btn btn-outline" href="{{ site.baseurl }}/screenshots">Explore the dashboard →</a>
    </div>
    <p class="wardkeep-trust"><span><b>⌂</b> Self-hosted</span><span><b>⌑</b> Your data stays yours</span><span><b>✓</b> Clear next actions</span></p>
  </div>
  <div class="device-macbook">
    <img src="{{ site.baseurl }}/assets/screenshots/desktop/dashboard.png?v={{ site.time | date: '%s' }}" alt="Wardkeep dashboard shown in a desktop device frame">
  </div>
</section>

## Your money is part of the picture. Your household is the point.

<p class="wardkeep-section-intro">Most finance apps stop at transactions. Wardkeep helps you understand what is happening, why it matters, how prepared you are, and what to do next—without pretending a household can be reduced to one perfect score.</p>

<div class="feature-grid">
  <div class="feature-card"><div class="feature-icon">◈</div><h3>See the whole picture</h3><p>Accounts, spending, budgets, debt, and recurring bills together instead of spread across tools.</p></div>
  <div class="feature-card"><div class="feature-icon">⌁</div><h3>Understand what matters</h3><p>A plain-language readiness view that separates what Wardkeep knows from what it has not evaluated.</p></div>
  <div class="feature-card"><div class="feature-icon">→</div><h3>Take the next right step</h3><p>Clear signals about spending pace, cash flow, and resilience before small issues become bigger surprises.</p></div>
</div>

## Start where you are

Connect or import your accounts, organize transactions, and set a budget when you are ready. Wardkeep becomes more useful as your picture becomes clearer; missing information is never treated as proof that everything is fine.

<div class="device-ipad">
  <img src="{{ site.baseurl }}/assets/screenshots/desktop/transactions.png?v={{ site.time | date: '%s' }}" alt="Wardkeep transactions shown in a tablet device frame">
</div>

## Built for privacy and clarity

Wardkeep can run in your own environment. Deterministic calculations—not AI—handle balances, forecasts, budgets, debt math, and readiness signals. AI is optional and can help explain, categorize, summarize, and surface patterns.

| Your preference | Wardkeep supports |
|:--|:--|
| Keep AI fully local | Ollama, with no external AI calls |
| Use a mix | Sensitive data stays local while general prompts can use a cloud provider |
| Move quickly | Optional OpenAI or Anthropic integrations |

[Self-host Wardkeep]({{ site.baseurl }}/deployment){: .btn .btn-primary }
[See the product direction]({{ site.baseurl }}/roadmap){: .btn .btn-outline }

---

## Want the details?

Wardkeep is open source. The technical material is here when you need it—not required to understand the product.

[Quick start]({{ site.baseurl }}/quick-start){: .btn .btn-outline }
[Release roadmap]({{ site.baseurl }}/roadmap){: .btn .btn-outline }
[All screenshots]({{ site.baseurl }}/screenshots){: .btn .btn-outline }
[Readiness model](https://github.com/reyvera/wardkeep/blob/main/docs/readiness-engine.md){: .btn .btn-outline }
[Product differentiation](https://github.com/reyvera/wardkeep/blob/main/docs/product-differentiation.md){: .btn .btn-outline }
[Source on GitHub](https://github.com/reyvera/wardkeep){: .btn .btn-outline }

Wardkeep is open source under [AGPL-3.0](https://github.com/reyvera/wardkeep/blob/main/LICENSE).
