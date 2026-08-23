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

| Pillar      | Current signals                                                                                               | Coverage state | Direction                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Protection  | Liquid reserves compared with ordinary expense burn rate; entered insurance policies and estate-planning records with review timing | Limited        | Add insurance adequacy, income interruption, estate adequacy, obligations, dependents, medical exposure, and secondary backstops. |
| Provision   | Budget pace, cash-flow forecast, bill coverage                                                                | Partial        | Add income stability, essential obligations, and recurring-payment reliability.                                          |
| Preparation | None                                                                                                          | Unevaluated    | Add goals, sinking funds, planned expenses, home, vehicle, and tax preparation.                                          |
| Prosperity  | Net-worth state, debt-to-income, debt payoff progress                                                         | Partial        | Add net-worth history, savings rate, investments, and interest burden.                                                   |
| Peace       | Derived from the least-ready observed pillar and recent volatility                                            | Derived        | Improve its explanation and make unknown upstream coverage visible.                                                      |

The `GET /api/readiness` response returns coverage, per-pillar assessments, and an `overallAssessment` alongside signals, ranked attention items, opportunities, and history. Every assessment carries a `known`, `partial`, or `not_evaluated` state, nullable score, evaluated capabilities, and coverage. Coverage currently represents evaluated finance capabilities against a transparent target count; it is a confidence indicator, not a statement that a household is a particular percentage complete.

### Current scoring behavior

- Signal magnitudes are bounded from -10 to +10 and aggregated with positive weights.
- A pillar with no signals receives no readiness credit. The UI presents it as **Not evaluated**, rather than presenting a false 100.
- The observed overall score re-normalizes the current default weights across evaluated direct pillars: Protection 25%, Provision 30%, Preparation 20%, Prosperity 25%. It is `null` when no direct pillar is evaluated and is explicitly marked partial until sufficient coverage exists. Peace is derived and is not weighted into overall readiness.
- Daily snapshots preserve overall and pillar score history as well as the contributing signals. The dashboard can show score movement since the last visit and only shows an overall trend for a sufficiently complete assessment.

## Protection: current contract

Protection presently evaluates **liquidity resilience**, limited insurance-record renewal awareness, and estate-record review timing—not insurance or estate adequacy, or comprehensive risk protection.

1. Wardkeep totals positive balances in active checking, savings, and cash accounts.
2. It estimates an ordinary monthly burn rate from the most recent 90 days of debit transactions.
3. The estimate excludes transfer records and filters common transfer-like descriptions, including credit-card payments, investments, savings transfers, and debt-principal payments. It also removes a checking or savings debit only when an equal credit on a recorded household credit-card account appears within three days; each card credit can match only one debit. A household can explicitly mark a debit as `one-time` in Transactions to omit it from this recurring burn-rate estimate; unmarked transactions remain included to avoid understating obligations.
4. It divides liquid reserves by that monthly burn rate to derive months of coverage.
5. The result follows a graduated curve: approximately 10 at zero months, 18 at one month, 33 at three months, 55 at six months, and 100 at twelve months. Progress between milestones is visible.

If Wardkeep cannot find ordinary expense history, it reports that coverage cannot be calculated rather than interpreting liquid savings as comprehensive protection.

This is deliberately conservative. The curve is a liquidity-resilience model, not financial advice or an insurance adequacy determination.

### Insurance records: first composite input

Wardkeep can now store user-entered active insurance policies (type, provider, premium and payment frequency, deductible, coverage amount, renewal date, and optional household notes). A policy nearing or past its recorded renewal date contributes an explainable Protection warning. Recorded policies with no imminent renewal contribute only a small evidence signal; Wardkeep does **not** infer that a policy is adequate, nor penalize a household for policy types it has not entered. Cancelled or replaced policies can be retained as inactive records and do not contribute to current readiness signals.

When one or more active policies include a deductible, Wardkeep also compares the sum of those recorded deductibles with liquid reserves. It warns only when recorded deductibles exceed currently available liquid reserves; it does not assume policies without a deductible have none, and it does not add deductibles to determine a household’s worst-case insurance exposure.

### Estate-planning records: review reminders, not legal evaluation

Wardkeep can record a document type, optional label, next review date, and non-sensitive reminder notes for wills, trusts, powers of attorney, healthcare directives, and beneficiary reviews. A past or upcoming recorded review date produces an explainable reminder. Otherwise, the presence of active records contributes only a small manual-evidence signal. Wardkeep does **not** store document contents or infer legal validity, beneficiary choices, accessibility, completeness, or adequacy. No estate record is interpreted as unknown—not a negative score or evidence that the household lacks a plan.

### Income-source context: planning records, not continuity prediction

Wardkeep can also record an expected income source, frequency, optional expected net amount, and review date. This produces a small manual-evidence signal or a reminder when the record is due for review. It does **not** determine that income will arrive, assess employment stability, or measure a household’s ability to withstand income interruption. No source record remains unknown rather than a negative readiness finding.

### Secondary liquidity: entered borrowing capacity only

Credit-card accounts can retain an optional credit limit and show available credit using the current recorded balance. This is presented as **borrowing capacity, not cash**. It is not currently used to increase Protection or emergency-fund coverage, and does not evaluate interest cost, approval risk, or whether borrowing is appropriate.

Policies also record whether their premium is separate or bundled into a mortgage escrow, loan/lease, or other account. The interface shows a normalized monthly equivalent and labels bundled amounts as already included in their linked payment. Home policies can include a property-tax escrow amount; when both are recorded, Wardkeep shows their combined monthly escrow estimate as a component of the mortgage payment. These fields identify an existing payment relationship so future cash-flow logic does not double-count a premium or tax already included in the linked payment; they do not currently alter transaction totals.

For an existing local development database created without Prisma Migrate history, use `pnpm prisma db push` to synchronize this schema. `pnpm prisma migrate deploy` is for a new or already-baselined production database.

## Dashboard contract

The Dashboard is Wardkeep’s household command center. It should lead with:

- household readiness, trend, and coverage;
- the strongest and most limited observed pillars;
- clickable pillar summaries with the factors Wardkeep did and did not evaluate, including entered insurance records, renewal timing, and recorded deductible-to-reserve checks. Every current factor identifies its data sources, calculation method, and known limitation;
- **Needs attention**, ranked by severity, urgency, financial impact, actionability, and confidence;
- **Wardkeep recommends**, a durable, prioritized list of active risk and warning actions that connects an observation to the relevant household workflow (such as accounts, policies, budget, cash flow, recurring bills, debt, or an explainable readiness factor). The Dashboard and Recommendations workspace refresh readiness before showing actions. People can complete or dismiss a recommendation, and review completed, dismissed, or resolved action history. When other observed factors remain, Wardkeep can show a qualified pillar-only score-change preview; financial amounts, overall-score projections, and time-to-completion remain forthcoming;
- **Since your last visit**, including a recorded score delta and a factor summary when the preceding signal snapshot supports one; and **Coming Up**, limited to recorded recurring-payment dates and policy renewals in the next 30 days.

The Financial Overview is distinct from the Dashboard. It contains accounts, net worth, budgets, transactions, and spending analysis. Its spending-pace chart must use cumulative transaction totals by date—never a straight line reconstructed from today’s average. A mid-month budget must distinguish remaining allocation, pace versus expectation, and projected month-end result.

Coverage and freshness are separate. Coverage reports how many currently supported factors Wardkeep evaluated. If one or more connected accounts are stale, Dashboard and pillar confidence are qualified as **Freshness needs review** without changing the underlying score or hiding the coverage percentage.

Manual accounts are reported as manual source data, not stale connected data: Wardkeep cannot infer when a person last verified a manual balance. Only a connected account whose synchronization is overdue or has never completed triggers the freshness warning.

Every displayed factor also names its evidence state. Current states are **synchronized**, **manual**, **mixed**, **stale**, **calculated**, and **unknown**. This describes the evidence behind that factor, independently from score coverage; it does not turn an inferred or missing input into evidence.

## API contract

```text
GET /api/readiness              assessments, signals, coverage, freshness, history, and recent changes
GET /api/readiness/history      daily snapshots for 1–90 days
```

Planned API additions:

```text
GET  /api/readiness/explain     structured pillar factors, gaps, and score-change reasons
POST /api/readiness/scenario    deterministic what-if result
GET  /api/recommendations       persisted risk/warning recommendations, status, action link, priority, and assumptions
PATCH /api/recommendations/:id  mark a recommendation completed or dismissed
GET  /api/timeline/upcoming     upcoming bills, renewals, maintenance, and planned costs
GET  /api/changes               meaningful changes since the user’s last visit
```

## Required next work

### Harden the scoring model

- [x] Scores return an explicit **known**, **partial**, or **not evaluated** assessment state, a nullable score, coverage, evaluated capabilities, and an observed-overall rule that re-normalizes across evaluated direct pillars.
- [~] Account source state and score evaluation time are displayed. Missing factor-level provenance and capability-specific freshness rules remain.
- Define capability-specific coverage factors and freshness rules. Manual, estimated, inferred, calculated, synchronized, stale, and unknown data must be distinguishable.
- Continue to develop essential and normal burn-rate views, including cautious treatment of large one-time expenses.
- Add test coverage for large one-time expenses, stale/manual data, and multiple simultaneous Protection signals.

### Make Protection composite

Protection must become an independently explainable model of financial shock resilience:

```text
liquidity + income resilience + insurance + fixed obligations
+ exposure + dependents + estate + secondary backstops
```

The first insurance-record, renewal-timing, and recorded-deductible-to-reserve slice is implemented. Adequacy checks, coverage gaps, disability/life assessment, and policy-document handling remain future work.

Available credit may reduce a short-term liquidity risk but must never be treated as cash. Missing insurance or estate information should remain unknown—not score as protected or exposed until Wardkeep has an appropriate observation.

### Complete the command center

- [x] Add a pillar-detail / readiness-explanation experience with evaluated factors, missing factors, trend, source data, and direct actions.
- [~] Persist signal snapshots and show a “Since your last visit” feed. Continue toward durable causal explanations, not just changed factors.
- Create a unified timeline for bills, renewals, tax dates, maintenance, subscriptions, sinking funds, and future replacement windows; surface it as “Coming up.”
- Extend durable recommendations with financial-impact weighting, monthly amount, overall-score projections, and time-to-completion. Current ranking uses severity, urgency, actionability, and evidence freshness; current impact previews hold the other observed pillar factors constant and do not infer financial impact that has not been modeled.
- Show impact previews before a user commits to a plan: current score, projected score, monthly contribution, and estimated completion date.
- Add scenarios such as income interruption, a surprise expense, debt payoff, vehicle purchase, and retirement-contribution changes.

## Non-goals for the current release

- A universal or authoritative “financial health” score.
- Claiming that a low-coverage household is safe or unsafe overall.
- Using generative AI to calculate balances, scores, or forecasts.
- Treating planned capabilities as implemented data sources.

For the complete sequenced work, see [the implementation plan](../.kiro/specs/ai-personal-finance-app/tasks.md). For the broader product philosophy, see [philosophy.md](philosophy.md).
