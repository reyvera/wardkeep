# Readiness Model 2 Implementation Checklist

## Objective

Replace the transitional five-pillar scoring model with Protection, Provision, Prosperity, and derived Peace while retaining model-1 history as a separately labeled series.

## Signal reclassification

| Current capability | Model 2 pillar | Reason |
| --- | --- | --- |
| Planned expenses | Provision | They affect near-term ability to meet obligations. |
| Vehicle lease ending | Provision | It is an upcoming household obligation and cash-flow decision. |
| Home asset lifecycle | Protection | It identifies an asset-resilience and replacement-risk gap. |
| Vehicle maintenance | Peace | It represents unresolved household administration requiring attention. |

## Cutover sequence

1. Increment `READINESS_MODEL_VERSION` to `2` and publish its taxonomy, weights (Protection 35%, Provision 35%, Prosperity 30%), coverage targets, and effective date.
2. Allow Peace signals and define its deterministic calculation as the more limited of direct readiness and recorded administrative attention; document that it is excluded from the weighted overall score.
3. Reclassify generators and their provenance, then remove Preparation from active score types, API responses, dashboard cards, detail routes, chat, and timeline filters.
4. Continue writing the legacy `preparation` database column as a compatibility placeholder for model-2 snapshots until a later archival migration; do not expose it in model-2 APIs.
5. Return model-1 history with an explicit legacy pillar payload, not as model-2 `PillarScores`.
6. Add a dashboard history selector only when two or more model versions exist. Its labels must identify version 1 as the legacy five-pillar model and prevent cross-version trend deltas.
7. Add scoring, generator, API, snapshot, and UI regression tests. Verify model-2 writes a new same-day snapshot beside model 1, rather than replacing it.

## Acceptance criteria

- No active model-2 response contains a Preparation pillar.
- A model-1 snapshot remains readable and labeled as legacy after model 2 is active.
- Model-1 and model-2 scores are never compared as one trend.
- Every reclassified signal has current provenance and a direct action route.
- Overall readiness uses only the published three direct weights; Peace remains derived.
