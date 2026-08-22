---
layout: default
title: Roadmap
nav_order: 5
permalink: /roadmap/
---

# Wardkeep Roadmap

Wardkeep is becoming a private household-readiness command center. Finance is the evidence layer—not the destination. The work is sequenced so the product earns trust before it expands its claims.

## Release map

<svg viewBox="0 0 760 245" role="img" aria-labelledby="roadmap-title roadmap-desc" style="width:100%; max-width:760px; height:auto; display:block; margin:1.5rem 0;">
  <title id="roadmap-title">Wardkeep release roadmap</title>
  <desc id="roadmap-desc">The finance foundation is complete. The decision engine is in progress. Household capabilities, community, cloud, and enterprise are future phases.</desc>
  <style>
    .phase { fill: #1f2937; stroke: #4b5563; stroke-width: 1; }
    .done { fill: #0f766e; }
    .active { fill: #b45309; }
    .future { fill: #374151; }
    .label { fill: #f3f4f6; font: 600 14px system-ui, sans-serif; }
    .sub { fill: #d1d5db; font: 12px system-ui, sans-serif; }
  </style>
  <rect class="phase" x="0" y="10" width="760" height="34" rx="5" />
  <rect class="done" x="0" y="10" width="760" height="34" rx="5" />
  <text class="label" x="16" y="32">Finance foundation</text>
  <text class="sub" x="620" y="32">Complete</text>
  <rect class="phase" x="0" y="61" width="760" height="34" rx="5" />
  <rect class="active" x="0" y="61" width="155" height="34" rx="5" />
  <text class="label" x="16" y="83">Decision engine</text>
  <text class="sub" x="598" y="83">In progress</text>
  <rect class="phase" x="0" y="112" width="760" height="34" rx="5" />
  <rect class="future" x="0" y="112" width="760" height="34" rx="5" />
  <text class="label" x="16" y="134">Household capabilities</text>
  <text class="sub" x="636" y="134">Future</text>
  <rect class="phase" x="0" y="163" width="760" height="34" rx="5" />
  <text class="label" x="16" y="185">Community and marketplace</text>
  <text class="sub" x="636" y="185">Future</text>
  <rect class="phase" x="0" y="214" width="760" height="34" rx="5" />
  <text class="label" x="16" y="236">Hosted convenience and enterprise</text>
  <text class="sub" x="636" y="236">Future</text>
</svg>

The amber segment is deliberately not a percentage: the decision-engine work should be measured by trusted launch gates, not an arbitrary completion number.

## Current release: Decision Engine

| Workstream | Status | Launch outcome |
|:--|:--|:--|
| Readiness foundation | In progress | Deterministic scores, explicit overall and pillar assessments, coverage indicators, finance signals, signal snapshots, and readiness dashboard |
| Trust and coverage | In progress | Explicit known/partial/not-evaluated states, account source and score freshness summaries, plus hardened burn-rate calculations; factor-level provenance remains |
| Composite Protection | Partial | Insurance records, renewal attention, deductible-to-reserve checks, and bundled-payment context are live. Adequacy, income interruption, estate, obligations, dependents, and secondary backstops remain. |
| Command center | Partial | Pillar explanations and a visit-aware change feed are in place; Coming Up, durable recommendations, and impact previews remain |
| Scenarios and planning | Planned | Deterministic what-if outcomes connected to household plans |

## Launch gates

Wardkeep launches the readiness experience only when these gates are true:

1. Scores never present missing information as good news.
2. A person can understand the factors, assumptions, coverage, and change behind each score.
3. Spending and budget analytics use actual transaction data and truthful projections.
4. The Dashboard answers what changed, what is coming, and what to do next.
5. Installation, upgrade, backup/restore, bank sync, CI, and support diagnostics are dependable.

## Public roadmap versus implementation tasks

This page is the public, outcome-oriented roadmap. The detailed engineering plan is maintained in the repository at [`.kiro/specs/ai-personal-finance-app/tasks.md`](https://github.com/reyvera/wardkeep/blob/main/.kiro/specs/ai-personal-finance-app/tasks.md).

GitHub Issues should be the execution tracker: one issue per independently reviewable outcome, linked to a release/milestone and labeled by phase, area, priority, and status. The long-form task plan remains the architecture and acceptance-criteria source of truth; issues should link back to the exact task section instead of duplicating it.

The [Decision Engine / Launch Readiness GitHub Project](https://github.com/users/reyvera/projects/1) now tracks the active launch-gate outcomes and their status. The next operational work is to expand it as independently reviewable outcomes are ready, use it for weekly sequencing, and repair the legacy task-sync hooks to use explicit issue references.
