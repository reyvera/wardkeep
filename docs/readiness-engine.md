# Readiness Engine Specification

## Purpose

The Readiness Engine is the heart of Wardkeep. It answers one question:

> Is this household prepared for what's coming?

It does this by aggregating signals from all active Capabilities into a unified, explainable readiness score. The score is never a black box — every point is traceable to a specific observation, and every recommendation links back to what would improve it.

## Design Principles

1. **Explainable.** Every score component can be traced to a specific signal from a specific Capability. Users can always ask "why?" and get a concrete answer.

2. **Deterministic.** Given the same inputs, the engine produces the same score. AI does not influence the score calculation — only the explanations and recommendations.

3. **Extensible.** Adding a new Capability automatically contributes to readiness without modifying the engine itself.

4. **Personal.** Readiness is relative to the household's own goals and context, not an arbitrary universal standard.

5. **Honest.** The score reflects reality. It doesn't inflate to make users feel good, and it doesn't deflate to drive engagement.

## Score Structure

### Overall Readiness

```
Household Readiness: 91%
```

A single number representing overall household preparedness. Computed as a weighted average of pillar scores.

### Pillar Scores

```
Protection:  98%  (Insurance, emergency fund, estate, security)
Provision:   94%  (Cash flow, bills, budget adherence)
Preparation: 78%  (Maintenance, goals, planning)
Prosperity:  87%  (Net worth trend, debt reduction, investments)
Peace:       92%  (Derived stability indicator)
```

Each pillar has its own score, computed from the signals of Capabilities that contribute to that pillar.

### Score Range

- **95–100%** — Excellent. Household is well-prepared across this dimension.
- **80–94%** — Good. Minor areas for improvement, no immediate risks.
- **60–79%** — Attention. Meaningful gaps that should be addressed.
- **40–59%** — Warning. Significant risks or unpreparedness.
- **0–39%** — Critical. Immediate action needed.

## Computation Model

### Signal Aggregation

Each Capability produces signals with a type and magnitude:

```typescript
interface Signal {
  type: 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';
  magnitude: number;  // -10 to +10
  pillar: ReadinessPillar;
  weight?: number;    // Optional override (default: 1.0)
}
```

### Pillar Score Calculation

For each pillar:

1. **Collect** all signals targeting this pillar from all active Capabilities.
2. **Normalize** magnitudes to a 0–100 contribution scale.
3. **Weight** signals by their source Capability's relevance to this pillar.
4. **Aggregate** into a pillar score using weighted average.
5. **Clamp** to 0–100.

```typescript
function computePillarScore(pillar: ReadinessPillar, signals: Signal[]): number {
  const pillarSignals = signals.filter(s => s.pillar === pillar);

  if (pillarSignals.length === 0) return 100; // No signals = no known risks

  const baseScore = 100;
  let totalImpact = 0;
  let totalWeight = 0;

  for (const signal of pillarSignals) {
    const weight = signal.weight ?? 1.0;
    // Risks reduce score, positives/milestones increase toward 100
    const impact = signal.magnitude * weight;
    totalImpact += impact;
    totalWeight += weight;
  }

  // Normalize impact relative to number and weight of signals
  const normalizedImpact = totalWeight > 0 ? (totalImpact / totalWeight) * 10 : 0;
  return Math.max(0, Math.min(100, baseScore + normalizedImpact));
}
```

### Overall Readiness Calculation

```typescript
interface PillarWeight {
  pillar: ReadinessPillar;
  weight: number;
}

const DEFAULT_WEIGHTS: PillarWeight[] = [
  { pillar: 'protection', weight: 0.25 },
  { pillar: 'provision', weight: 0.30 },
  { pillar: 'preparation', weight: 0.20 },
  { pillar: 'prosperity', weight: 0.20 },
  { pillar: 'peace', weight: 0.05 },
];

function computeOverallReadiness(pillarScores: Map<ReadinessPillar, number>): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const { pillar, weight } of DEFAULT_WEIGHTS) {
    const score = pillarScores.get(pillar) ?? 100;
    totalScore += score * weight;
    totalWeight += weight;
  }

  return Math.round(totalScore / totalWeight);
}
```

### Personalization

Users can adjust pillar weights based on their priorities:

- A household focused on debt elimination might weight Prosperity higher.
- A household with young children might weight Protection higher.
- A household approaching retirement might weight Provision higher.

The defaults are sensible for most households but never imposed.

## Explainability

Every point deducted or added is traceable:

```typescript
interface ReadinessExplanation {
  overallScore: number;
  pillars: PillarExplanation[];
  topRisks: SignalExplanation[];
  topOpportunities: SignalExplanation[];
  recentChanges: ScoreChange[];
}

interface PillarExplanation {
  pillar: ReadinessPillar;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  contributingSignals: SignalExplanation[];
}

interface SignalExplanation {
  capabilityId: string;
  summary: string;
  impact: number;
  actionable: boolean;
  recommendation?: string;
}

interface ScoreChange {
  date: Date;
  previousScore: number;
  newScore: number;
  reason: string;
}
```

### Example Explanation

```json
{
  "overallScore": 91,
  "pillars": [
    {
      "pillar": "preparation",
      "score": 78,
      "trend": "stable",
      "contributingSignals": [
        {
          "capabilityId": "home",
          "summary": "Water heater is 12 years old (average lifespan: 10-15 years)",
          "impact": -8,
          "actionable": true,
          "recommendation": "Set aside $100/month for replacement. At current rate, fully funded in 12 months."
        },
        {
          "capabilityId": "vehicle",
          "summary": "Oil change due in 400 miles",
          "impact": -3,
          "actionable": true,
          "recommendation": "Schedule oil change this week."
        }
      ]
    }
  ],
  "topRisks": [
    {
      "capabilityId": "home",
      "summary": "Roof replacement estimated in 4 years. No sinking fund allocated.",
      "impact": -12,
      "actionable": true,
      "recommendation": "Setting aside $120/month would fully fund replacement without affecting retirement goals."
    }
  ]
}
```

## Score History and Trends

The engine stores daily snapshots of overall and pillar scores:

```typescript
interface ReadinessSnapshot {
  date: Date;
  overall: number;
  pillars: Record<ReadinessPillar, number>;
  activeCapabilities: string[];
  signalCount: number;
}
```

This enables:
- **Trend visualization** — Is the household improving over time?
- **Impact tracking** — After taking a recommended action, did readiness actually improve?
- **Seasonal patterns** — Does readiness dip in December (holiday spending) or October (property taxes)?

## The Peace Pillar

The Peace pillar is special — it's derived, not directly contributed to.

It represents overall household stability and is computed from:
- Consistency of other pillar scores (low volatility = high peace)
- Absence of critical-level signals across all pillars
- Trend direction (all pillars improving = higher peace)
- Goal progress (on track = higher peace)

```typescript
function computePeace(pillarScores: Map<ReadinessPillar, number>, history: ReadinessSnapshot[]): number {
  const scores = [...pillarScores.values()];
  const minScore = Math.min(...scores);
  const volatility = computeVolatility(history, 30); // 30-day volatility

  // Peace is high when: no pillar is critical AND volatility is low AND trend is positive
  let peace = minScore; // Floor is the weakest pillar
  peace -= volatility * 10; // Penalize instability
  peace += getTrendBonus(history); // Reward consistent improvement

  return Math.max(0, Math.min(100, Math.round(peace)));
}
```

## Readiness Without Data

A new user has no observations. The engine handles this gracefully:

- **No Capabilities active:** Readiness displays as "—" with a prompt to set up their first Capability.
- **Partial data:** Score is computed from available signals only. Missing Capabilities don't penalize — they simply don't contribute.
- **Progressive disclosure:** As users add Capabilities, their readiness picture becomes more complete. The UI communicates: "Your readiness score covers 3 of 8 possible areas. Adding Insurance would give you a more complete picture."

## Integration with the Advisor

The Readiness Engine is deterministic. It computes scores from signals.

The Advisor (AI layer) consumes readiness data to:
1. **Explain** scores in natural language ("Your Preparation score dropped because...")
2. **Prioritize** recommendations ("Based on impact and effort, here's what to do first...")
3. **Cross-reference** signals ("Your insurance renewal + your emergency fund level suggests...")
4. **Generate** the Morning Brief, Weekly Brief, and Monthly Brief

The Advisor never modifies scores. It only interprets them.

## Future: Scenario Modeling

A natural extension of the Readiness Engine:

> "What happens to my readiness if I lose my job?"

The engine can recompute scores with hypothetical signal changes:
- Remove income signals
- Add unemployment duration estimate
- Recalculate all pillar scores
- Show the projected readiness trajectory

This transforms Wardkeep from "how am I doing?" to "how would I be doing if...?" — which is the ultimate preparedness question.
