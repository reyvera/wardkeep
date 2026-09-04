# Readiness Model 2 Implementation Checklist

## Completion record

Implemented: the active model uses Protection, Provision, Prosperity, and derived Peace, while model-1 history remains a separately labeled legacy series.

## Signal reclassification

| Current capability | Model 2 pillar | Reason |
| --- | --- | --- |
| Planned expenses | Provision | They affect near-term ability to meet obligations. |
| Vehicle lease ending | Provision | It is an upcoming household obligation and cash-flow decision. |
| Home asset lifecycle | Protection | It identifies an asset-resilience and replacement-risk gap. |
| Vehicle maintenance | Peace | It represents unresolved household administration requiring attention. |

## Implemented cutover

1. `READINESS_MODEL_VERSION` is `2`, effective **September 3, 2026**, with published 35% / 35% / 30% direct weights.
2. Peace is derived from observed direct readiness and recorded administrative attention; it is excluded from the weighted overall score.
3. Former Preparation signals are reclassified, and active score types, API responses, dashboard cards, detail routes, chat, and timeline filters exclude Preparation.
4. The legacy `preparation` database column remains a compatibility placeholder for model-2 snapshots and is not exposed in model-2 APIs.
5. Model-1 history returns its original legacy pillar payload rather than model-2 `PillarScores`.
6. The dashboard history selector appears only when two or more model versions exist, labels version 1 as the legacy five-pillar model, and prevents cross-version deltas.
7. Readiness package, API, and web validation cover the cutover contract; model-2 snapshots are keyed separately from model 1.

## Acceptance criteria

- No active model-2 response contains a Preparation pillar.
- A model-1 snapshot remains readable and labeled as legacy after model 2 is active.
- Model-1 and model-2 scores are never compared as one trend.
- Every reclassified signal has current provenance and a direct action route.
- Overall readiness uses only the published three direct weights; Peace remains derived.
