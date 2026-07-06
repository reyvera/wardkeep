# Wardkeep Terminology Guide

## Purpose

Consistency in language shapes how people think about a product — both the team building it and the users experiencing it. Every word in Wardkeep is intentional. This guide establishes the vocabulary used in code, UI, documentation, and communication.

## Core Terms

| Term | Definition | Replaces |
|------|-----------|----------|
| **Household** | The unit Wardkeep serves. Could be one person, a couple, a family, or a shared living arrangement. | User, Account holder |
| **Readiness** | The state of being prepared for what's coming. The primary metric. | Score, Health, Status |
| **Capability** | A domain of household knowledge that contributes to readiness. | Plugin, Module, Feature, Add-on |
| **Advisor** | The AI layer that explains, prioritizes, and recommends. | AI, Chatbot, Assistant |
| **Signal** | An interpreted observation that affects readiness (risk, opportunity, milestone). | Alert, Notification, Flag |
| **Observation** | A raw fact about the household, produced by a Capability. | Data point, Record |
| **Insight** | A human-readable explanation derived from signals and cross-capability reasoning. | Report, Summary |
| **Pillar** | One of five dimensions of household readiness. | Category, Area, Domain |
| **Household Timeline** | A unified chronological view of past and future events across all Capabilities. | Calendar, History, Schedule |
| **Morning Brief** | The daily summary of what matters today. | Dashboard, Home screen, Daily digest |
| **Recommendation** | A specific action the user could take to improve readiness. | Suggestion, Tip, Alert |

## The Five Pillars

| Pillar | Meaning | Covers |
|--------|---------|--------|
| **Protection** | Shielding the household from catastrophe | Insurance, emergency fund, estate, security, passwords |
| **Provision** | Ensuring the household runs smoothly day to day | Cash flow, bills, income, budget, spending |
| **Preparation** | Being ready for what's ahead | Maintenance, taxes, goals, education, seasonal tasks |
| **Prosperity** | Growing the household's position over time | Net worth, investments, debt reduction, giving |
| **Peace** | Overall stability and confidence | Derived from the health of all other pillars |

## UI Language

### Navigation and Headers

| Use | Don't Use |
|-----|-----------|
| Household Readiness | Score, Health Check |
| Advisor | AI Chat, Ask AI |
| Capabilities | Modules, Features, Plugins |
| Morning Brief | Dashboard, Home |
| Household Timeline | Calendar, Events |
| Provision | Budget, Money |
| Protection | Insurance, Safety |

### Status Indicators

| Level | UI Label | Color Intent |
|-------|----------|-------------|
| 95–100% | Excellent | Green |
| 80–94% | Good | Teal/Light Green |
| 60–79% | Attention | Amber |
| 40–59% | Warning | Orange |
| 0–39% | Critical | Red |

### Action Language

| Use | Don't Use |
|-----|-----------|
| "Renew auto insurance" | "Action required: auto insurance" |
| "Set aside $120/month for roof replacement" | "Alert: roof replacement needed" |
| "Your emergency fund reached six months" | "Goal completed!" |
| "Schedule oil change this week" | "Maintenance overdue" |

The tone is calm, direct, and advisory — like a trusted friend who happens to know everything about your household.

### Advisor Language

The Advisor speaks in first person plural or direct address:

| Use | Don't Use |
|-----|-----------|
| "Your mortgage is due in 6 days" | "REMINDER: Mortgage payment" |
| "Based on your spending, you'll likely come in under budget by $95" | "Budget forecast: -$95 variance" |
| "Your biggest risk this quarter is the roof" | "Risk alert: Roof" |
| "I'd recommend increasing your emergency fund by $75/month" | "Suggestion: increase emergency fund" |

## Code Terminology

### File and Class Naming

```
capability/           (not module/, plugin/, feature/)
  vehicle.capability.ts
  insurance.capability.ts

readiness/
  readiness.engine.ts
  readiness.snapshot.ts

advisor/              (not ai/, chat/, assistant/)
  advisor.service.ts
  morning-brief.service.ts

signals/              (not alerts/, notifications/)
  signal.types.ts
  signal.aggregator.ts

timeline/             (not calendar/, events/)
  timeline.service.ts
  timeline-event.types.ts
```

### Interface Naming

```typescript
// Capabilities
interface Capability { }
interface CapabilityMetadata { }
interface CapabilityRegistry { }

// Readiness
interface ReadinessScore { }
interface ReadinessSnapshot { }
interface ReadinessExplanation { }
interface PillarScore { }

// Signals
interface Signal { }
interface Observation { }
interface Recommendation { }

// Advisor
interface AdvisorResponse { }
interface MorningBrief { }
interface WeeklyBrief { }

// Timeline
interface TimelineEvent { }
interface HouseholdTimeline { }
```

### Variable Naming

```typescript
// Good
const readinessScore = computeReadiness(signals);
const pillarScores = computePillarScores(signals);
const morningBrief = advisor.generateBrief(household);
const capabilities = registry.all();
const signals = capability.signals();
const recommendations = capability.recommendations();

// Avoid
const healthScore = ...;      // "Health" is not our language
const plugins = ...;          // "Plugins" is internal-only at best
const alerts = ...;           // We don't "alert" — we "advise"
const chatResponse = ...;     // It's not a chat — it's the Advisor
const modules = ...;          // NestJS uses "module" internally; we use "Capability" in domain code
```

## Words We Don't Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Budget (as primary framing) | Feels restrictive, implies deprivation | Provision, Spending Plan |
| Alert | Implies urgency/alarm; most guidance isn't urgent | Signal, Recommendation |
| Notification | Generic, easily ignored | Brief, Insight |
| Plugin | Implies optional/lesser | Capability |
| Module | Too technical for users | Capability |
| Dashboard | Implies passive data display | Morning Brief, Readiness |
| Health Score | Medical connotation | Readiness |
| AI | Generic, overhyped | Advisor |
| Chatbot | Implies reactive, limited | Advisor |
| Feature | Everything is a "feature" — meaningless | Capability (for domains), specific name otherwise |
| Sync | Technical detail users shouldn't think about | "Updated" or invisible |

## Communication Tone

### Headlines and Marketing

| Use | Don't Use |
|-----|-----------|
| Know your household is prepared | Budget better |
| Confidence for your household | Track your spending |
| Your household, understood | Manage your money |
| Readiness, not anxiety | Never miss a bill |

### Error Messages

| Use | Don't Use |
|-----|-----------|
| "Couldn't reach your bank. We'll try again shortly." | "Error: Connection failed (code 503)" |
| "The Advisor is thinking. This usually takes a few seconds." | "Loading AI response..." |
| "We need a bit more information to compute your Readiness." | "Insufficient data for calculation" |

## Versioning This Document

As Wardkeep evolves, new terms will emerge. This document is the source of truth. When introducing a new concept:

1. Define it here first.
2. Ensure it doesn't conflict with existing terms.
3. Verify it passes the "would a user understand this without explanation?" test.
4. Update code, UI, and documentation to use it consistently.
