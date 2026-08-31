# Wardkeep Product Differentiation Specification

**Document type:** Product / Strategy Specification  
**Status:** Draft

## 1. Product positioning

Wardkeep is not primarily a budgeting application. It is a private, self-hostable household-readiness platform that begins with finance and expands toward a broader question: **Is my household prepared, what requires attention, and what should I do next?**

Traditional finance products organize and visualize data. Wardkeep combines accurate household data with deterministic analysis and actionable recommendations.

```text
Observe → Understand → Evaluate readiness → Recommend action → Track improvement
```

Wardkeep competes on household readiness and decision support, not on collecting the most financial charts.

## 2. Market context and core promise

Budgeting, aggregation, transaction management, net-worth tracking, recurring bills, investments, category analysis, and dashboards are increasingly commoditized. Self-hosting alone is also not enough: established open-source tools already provide private financial management.

Wardkeep differentiates through **deterministic, explainable whole-household readiness evaluation** across financial and non-financial domains, supported by privacy, self-hosting, and actionable guidance. It should answer four questions exceptionally well:

1. What is happening in my household?
2. Why does it matter?
3. How prepared am I?
4. What should I do next?

Major features must contribute to at least one of those questions. Information presentation alone is not sufficient priority unless it improves the readiness model.

Conversational AI, financial recommendations, and AI-powered forecasting are foundational product capabilities—not primary competitive differentiation. They may help people understand and act on the evaluation, but Wardkeep's distinct value is the deterministic, explainable evaluation itself: what evidence was considered, what was not evaluated, how each readiness pillar was assessed, and why attention is needed.

## 3. Household model

The primary abstraction is the household, not the bank account. Accounts are evidence about readiness rather than the center of the product.

```text
Household
├── Finances — accounts, transactions, budgets, income, debt, savings, investments
├── Protection — insurance, reserves, income protection, liability, estate/legal readiness
├── Property & Assets — home, vehicles, equipment, warranties, maintenance
├── Documents — policies, warranties, titles, contracts, important records
├── Obligations — bills, renewals, taxes, maintenance, recurring commitments
└── Readiness — protection, provision, prosperity, peace
```

Finance is Wardkeep's first and deepest domain, but it must not permanently define the product boundary.

## 4. Readiness framework

The strategic readiness model has four pillars:

| Pillar         | Question                                                         | Representative signals                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Protection** | How resilient is the household against unexpected loss?          | Emergency reserves, insurance and renewals, income protection, liability exposure, emergency documents, estate-plan completeness                                       |
| **Provision**  | Can the household reliably meet near-term needs and obligations? | Cash flow, essential expenses, runway, upcoming bills, income stability, recurring obligations, cash reserves, budget sustainability                                   |
| **Prosperity** | Is the household moving toward long-term financial strength?     | Debt trajectory, savings rate, retirement contributions, investment growth, net-worth direction, goals, major future purchases                                         |
| **Peace**      | How much unresolved household administration requires attention? | Overdue obligations, renewals, uncategorized transactions, unreviewed alerts, irregular cash flow, incomplete data, maintenance deadlines, outstanding recommendations |

Protection surfaces weaknesses and missing information. Provision emphasizes upcoming risk, not merely historical spending. Prosperity measures trajectory, not only current wealth. Peace is an attention-load measure; it does not claim to measure emotional or psychological well-being.

The current implementation retains a transitional `Preparation` pillar. It should be migrated into the four-pillar model as its signals are reclassified (for example, future obligations under Provision, asset resilience under Protection, and long-term planned purchases under Prosperity). This specification is the target taxonomy; it does not misrepresent the currently deployed scoring contract.

### Pillar migration contract

The transition from the current five-pillar implementation must preserve user trust and historical meaning:

1. Reclassify each current `Preparation` signal by its household consequence before removing the pillar. Recorded planned expenses and near-term lease decisions belong in **Provision**; asset replacement resilience belongs in **Protection**; long-term purchase and payoff plans belong in **Prosperity**; unresolved maintenance and administrative deadlines contribute to **Peace**.
2. Version readiness snapshots and signal provenance with the taxonomy used to calculate them. Historical `Preparation` values remain visible as legacy history and must not be relabeled as a current pillar.
3. Expose old and new score series as non-comparable during the cutover unless Wardkeep can recalculate a historical period from the same underlying observations using the new deterministic rules.
4. Do not choose new weights solely to preserve a familiar overall score. Publish the weights, coverage targets, factor changes, and effective date with the new model.
5. Ship the API and dashboard migration together: clients must never receive a four-pillar label set with five-pillar data, or the reverse.

This is a product-model migration, not a cosmetic rename.

**Default migration weights:** until household evidence supports revisiting the model, direct overall readiness should weight Protection at **35%**, Provision at **35%**, and Prosperity at **30%**. Peace remains a derived attention-load pillar and is not included in the weighted overall score. This intentionally gives resilience and near-term obligations slightly more weight than long-term trajectory; it is not calibrated to preserve a prior score.

## 5. Explainability, deterministic scoring, and coverage

Every readiness score must be explainable. A score must expose its contributing factors, their state, and what Wardkeep did not evaluate:

```text
Protection — 68%
Emergency reserves      Strong
Insurance coverage      Good
Upcoming renewals       Attention
Income protection       Unknown
Estate documents        Not evaluated
```

Scores are derived from deterministic rules wherever practical. AI may explain results, but it must never invent the score or its source facts.

Readiness and data coverage are separate. “Healthy” and “unknown because no data exists” must never be treated as equivalent. Every pillar maintains a coverage indicator that makes known and unknown inputs visible, guides onboarding, and prevents false reassurance.

## 6. Action engine

Analysis must lead to action. Every meaningful readiness signal should be capable of producing a recommendation with:

```text
title · explanation · pillar · severity · confidence · supporting data
estimated impact · suggested action · due/relevance date · completion state
```

Example:

> **Reserve funds for upcoming auto-insurance renewal**  
> Your policy renews in 24 days. Based on the previous premium, approximately $1,420 will be required. Current projected discretionary cash before renewal is $1,870. Reserve $1,420 before making additional accelerated debt payments.

Recommendations are ranked by urgency, financial impact, household risk, confidence, and actionability. The dashboard generally emphasizes the one to three highest-value actions. Wardkeep behaves like a calm household advisor, not an alert inbox.

## 7. Dashboard principle

The dashboard answers **what deserves my attention right now?**, rather than displaying every available financial metric.

```text
Household Readiness
Protection 72% · Provision 84% · Prosperity 61% · Peace 77%

Needs attention
1. Auto insurance renews in 24 days
2. Emergency fund is below the four-month target
3. Credit-card payoff can be accelerated

Recommended next step
Reserve $1,420 for insurance renewal.

Financial overview
Net worth · Cash flow · Budgets · Accounts · Debt · Transactions
```

Detailed financial views remain available, but are secondary to the readiness layer.

## 8. AI, privacy, and self-hosting

**AI is not the source of truth or the primary differentiator.** Deterministic systems calculate balances, cash flow, debt payoff, budgets, forecasts, readiness scores, ratios, deadlines, and coverage. AI can assist with categorization, explanation, summarization, pattern recognition, conversation, and recommendation wording. Those foundational capabilities must remain subordinate to, and clearly distinguishable from, the deterministic readiness evaluation.

Wardkeep supports three clear privacy modes:

| Mode       | Data and AI posture                                                         |
| ---------- | --------------------------------------------------------------------------- |
| **Local**  | Local database and financial data; Ollama; no external AI                   |
| **Hybrid** | Sensitive calculations stay local; optional cloud AI handles selected tasks |
| **Cloud**  | Wardkeep operates infrastructure for users who prefer convenience           |

The product clearly indicates when information leaves the user's environment.

Wardkeep Community is a legitimate self-hosted product, including the core readiness engine, accounts, transactions, budgets, debt, recommendations, local AI, imports, SimpleFIN compatibility, household data, backups, and deployment. Paid offerings sell hosted operation, updates, backups, remote access, notifications, sharing, connectivity, and optional cloud AI—not access to a user's own data.

## 9. Guardrails and feature evaluation

Wardkeep does not prioritize advanced investment analytics, stock research, crypto or day-trading dashboards, tax preparation, brokerage execution, endless charts, hyper-granular budgeting, social finance, or credit-score gamification merely because competitors offer them. They become relevant only when they materially improve readiness.

Evaluate each proposed feature:

1. Does it improve household awareness?
2. Does it improve readiness evaluation?
3. Does it enable useful action?
4. Does it improve important data completeness?
5. Does it reinforce Wardkeep's differentiation rather than imitate a conventional budgeting product?

Before significant work, ask: **Are we building a better Wardkeep or merely matching Monarch?** “A competitor has this” is not a sufficient rationale; “Wardkeep needs this data to improve its readiness model” is.

## 10. Target experiences

An emergency fund is not merely a balance against a goal. Wardkeep interprets it as reserve months against essential expenses, adjusts that view for recorded upcoming pressure, and recommends the next prudent allocation of funds.

Debt is not merely a balance and APR. Wardkeep should show the trajectory, interest cost at the current payment, payoff and savings under an alternative payment, and whether accelerating repayment keeps reserves above the household's minimum.

Future Property, Vehicle, Documents, and Preparedness capabilities—maintenance, warranties, registrations, insurance, estate records, emergency supplies, contacts, and resilience plans—must connect to the same readiness and recommendation system, not become unrelated mini-applications.

## 11. Brand and success criteria

**Preferred positioning:** Wardkeep is the private command center for household readiness.

**Supporting statement:** Connect your finances, obligations, assets, and household information. Wardkeep explains where you stand, identifies what needs attention, and helps you prepare for what comes next.

**Short form:** Guard your ground. Know what comes next.

Within roughly ten seconds, a new user should understand that Wardkeep is more than a budget tracker; evaluates the household as a whole; identifies attention, explains why, recommends a concrete next action, and can keep household data private and self-hosted. If a screenshot could be mistaken for a standard finance dashboard, the differentiation has not been expressed strongly enough.

## 12. Immediate direction and strategic rule

Near-term work prioritizes strengthening explainable readiness scoring, data-coverage reporting, the recommendation/action system, an attention-first dashboard, household models that improve readiness, and robust self-hosting followed by managed-cloud delivery. Traditional finance expansion is selective and supports those systems.

> Do not compete on who can display the most financial information or offer the flashiest AI. Compete on who can deterministically and transparently evaluate whole-household readiness from financial and non-financial evidence, then provide the clearest understanding of what to do next.
