# Readiness Engine

## Purpose

Wardkeep answers a practical household question:

> How prepared are we for what is happening now and what is coming next—and how certain is that answer?

Readiness is not a credit score, an engagement metric, or a claim of complete financial health. It is a deterministic interpretation of the information Wardkeep has evaluated. Every score must be accompanied by coverage: how much of the relevant household picture is actually known.

The product loop is:

```text
observations → explainable signals → readiness + coverage → prioritized action → plan → measured improvement
```

AI may explain, summarize, and prioritize this information. It never supplies facts or changes a readiness score.

## Principles

1. **Unknown is not healthy.** Missing insurance, estate, income, expense, or account data is not positive evidence. The interface must say what Wardkeep has not evaluated.
2. **Explainable and deterministic.** Given the same records, the engine returns the same signals and scores. A user can see the contributing factors and the general path to improvement.
3. **Coverage and readiness are separate.** Readiness describes the observed position; coverage describes confidence in that interpretation.
4. **Actionable.** The dashboard should answer “what should I do next?”, not merely list metrics or risks.
5. **Extensible.** Finance is the first evidence layer. Insurance, home, vehicle, estate, medical, and other capabilities will contribute independently without turning the engine into a black box.

## Current implementation

The first readiness release is intentionally a foundation, not a comprehensive household assessment.

| Pillar | Current signals | Coverage state | Direction |
|---|---|---|---|
| Protection | Liquid reserves compared with ordinary expense burn rate | Limited | Add income interruption, insurance, estate, obligations, dependents, medical exposure, and secondary backstops. |
| Provision | Budget pace, cash-flow forecast, bill coverage | Partial | Add income stability, essential obligations, and recurring-payment reliability. |
| Preparation | None | Unevaluated | Add goals, sinking funds, planned expenses, home, vehicle, and tax preparation. |
| Prosperity | Net-worth state, debt-to-income, debt payoff progress | Partial | Add net-worth history, savings rate, investments, and interest burden. |
| Peace | Derived from the least-ready observed pillar and recent volatility | Derived | Improve its explanation and make unknown upstream coverage visible. |

The `GET /api/readiness` response returns `coverage` and `pillarCoverage` alongside scores, signals, ranked attention items, opportunities, and history. Coverage currently represents evaluated finance capabilities against a transparent target count; it is a confidence indicator, not a statement that a household is a particular percentage complete.

### Current scoring behavior

- Signal magnitudes are bounded from -10 to +10 and aggregated with positive weights.
- A pillar with no signals receives no readiness credit. The UI presents it as **Not evaluated**, rather than presenting a false 100.
- Overall readiness uses the current default pillar weights: Protection 25%, Provision 30%, Preparation 20%, Prosperity 25%. Peace is derived and is not weighted into overall readiness.
- Daily snapshots preserve overall and pillar score history. The dashboard displays up to 90 days of available trend data.

## Protection: current contract

Protection presently evaluates **liquidity resilience**, not insurance or comprehensive risk protection.

1. Wardkeep totals positive balances in active checking, savings, and cash accounts.
2. It estimates an ordinary monthly burn rate from the most recent 90 days of debit transactions.
3. The estimate excludes transfer records and filters common transfer-like descriptions, including credit-card payments, investments, savings transfers, and debt-principal payments. Unknown transactions remain included to avoid understating obligations.
4. It divides liquid reserves by that monthly burn rate to derive months of coverage.
5. The result follows a graduated curve: approximately 10 at zero months, 18 at one month, 33 at three months, 55 at six months, and 100 at twelve months. Progress between milestones is visible.

If Wardkeep cannot find ordinary expense history, it reports that coverage cannot be calculated rather than interpreting liquid savings as comprehensive protection.

This is deliberately conservative. The curve is a liquidity-resilience model, not financial advice or an insurance adequacy determination.

## Dashboard contract

The Dashboard is Wardkeep’s household command center. It should lead with:

- household readiness, trend, and coverage;
- the strongest and most limited observed pillars;
- clickable pillar summaries with the factors Wardkeep did and did not evaluate;
- **Needs attention**, ranked by severity, urgency, financial impact, actionability, and confidence;
- **Wardkeep recommends**, which connects an observation to a concrete next action;
- eventually, **Coming up** and **Since your last visit**.

The Financial Overview is distinct from the Dashboard. It contains accounts, net worth, budgets, transactions, and spending analysis. Its spending-pace chart must use cumulative transaction totals by date—never a straight line reconstructed from today’s average. A mid-month budget must distinguish remaining allocation, pace versus expectation, and projected month-end result.

## API contract

```text
GET /api/readiness              current score, pillars, signals, coverage, history
GET /api/readiness/history      daily snapshots for 1–90 days
```

Planned API additions:

```text
GET  /api/readiness/explain     structured pillar factors, gaps, and score-change reasons
POST /api/readiness/scenario    deterministic what-if result
GET  /api/recommendations       ranked recommendations with effort and impact preview
GET  /api/timeline/upcoming     upcoming bills, renewals, maintenance, and planned costs
GET  /api/changes               meaningful changes since the user’s last visit
```

## Required next work

### Harden the scoring model

- Represent a score as **known**, **partial**, or **not evaluated** in the API instead of relying only on a numeric sentinel.
- Define capability-specific coverage factors and freshness rules. Manual, estimated, inferred, calculated, synchronized, stale, and unknown data must be distinguishable.
- Exclude transfers structurally, match credit-card payments to underlying purchases, and develop essential and normal burn-rate views.
- Add test coverage for zero to 12+ months of reserves, no expense history, transfers, duplicated card payments, large one-time expenses, stale/manual data, and multiple simultaneous Protection signals.

### Make Protection composite

Protection must become an independently explainable model of financial shock resilience:

```text
liquidity + income resilience + insurance + fixed obligations
+ exposure + dependents + estate + secondary backstops
```

Available credit may reduce a short-term liquidity risk but must never be treated as cash. Missing insurance or estate information should remain unknown—not score as protected or exposed until Wardkeep has an appropriate observation.

### Complete the command center

- Add a pillar-detail / readiness-explanation experience with evaluated factors, missing factors, trend, and direct actions.
- Persist meaningful score-change reasons, then add a “Since your last visit” feed.
- Create a unified timeline for bills, renewals, tax dates, maintenance, subscriptions, sinking funds, and future replacement windows; surface it as “Coming up.”
- Turn signals into durable recommendations ranked by severity × urgency × financial impact × actionability × confidence.
- Show impact previews before a user commits to a plan: current score, projected score, monthly contribution, and estimated completion date.
- Add scenarios such as income interruption, a surprise expense, debt payoff, vehicle purchase, and retirement-contribution changes.

## Non-goals for the current release

- A universal or authoritative “financial health” score.
- Claiming that a low-coverage household is safe or unsafe overall.
- Using generative AI to calculate balances, scores, or forecasts.
- Treating planned capabilities as implemented data sources.

For the complete sequenced work, see [the implementation plan](../.kiro/specs/ai-personal-finance-app/tasks.md). For the broader product philosophy, see [philosophy.md](philosophy.md).
