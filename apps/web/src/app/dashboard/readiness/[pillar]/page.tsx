'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Shield,
  TrendingUp,
  Wallet,
  Hammer,
  PiggyBank,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';

type PillarKey = 'protection' | 'provision' | 'preparation' | 'prosperity' | 'peace';

interface Signal {
  capabilityId: string;
  type: 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';
  magnitude: number;
  pillar: PillarKey;
  summary: string;
  provenance?: {
    sources: string[];
    method: string;
    limitation: string;
    evidenceState: 'synchronized' | 'manual' | 'mixed' | 'stale' | 'calculated' | 'unknown';
  };
}

interface ReadinessExplanation {
  evaluatedAt: string;
  pillars: Array<{
    pillar: PillarKey;
    assessment: {
      state: 'known' | 'partial' | 'not_evaluated';
      score: number | null;
      coverage: number;
      evaluatedCapabilities: string[];
    };
    factors: Signal[];
    notEvaluated: Array<{ id: string; label: string }>;
  }>;
  dataFreshness: {
    synchronizedAccounts: number;
    manualAccounts: number;
    staleAccounts: number;
    lastSynchronizedAt: string | null;
  };
  recentChanges: Array<{
    pillar: PillarKey;
    delta: number;
    comparedTo: string;
    reason: string | null;
  }>;
  pillarTrends: Record<
    PillarKey,
    {
      direction: 'improving' | 'declining' | 'steady' | 'not_enough_history';
      label: string;
      delta: number | null;
      comparedTo: string | null;
      elapsedDays: number | null;
    }
  >;
  changeWindow: 'since_last_visit' | 'since_last_snapshot' | 'none';
}

const PILLARS: Record<
  PillarKey,
  {
    label: string;
    icon: typeof Shield;
    description: string;
    sources: string[];
    observed: Array<{ capability: string; label: string }>;
    next: string[];
  }
> = {
  protection: {
    label: 'Protection',
    icon: Shield,
    description: 'How prepared your household is for a surprise expense or loss of income.',
    sources: [
      'Account balances',
      'Recent debit transactions',
      'Insurance, estate-planning, and income-source records',
    ],
    observed: [
      {
        capability: 'emergency-fund',
        label: 'Money available now compared with everyday spending',
      },
      { capability: 'insurance', label: 'Entered insurance policies and renewal timing' },
      {
        capability: 'insurance-record-details',
        label: 'Completeness of entered insurance policy details',
      },
      {
        capability: 'insurance-deductibles',
        label: 'Out-of-pocket insurance costs compared with money available now',
      },
      {
        capability: 'estate-documents',
        label: 'Entered estate-planning records and review timing',
      },
      { capability: 'income-sources', label: 'Entered income sources and review timing' },
      {
        capability: 'secondary-liquidity',
        label: 'Recorded available credit when nearly exhausted',
      },
      {
        capability: 'fixed-obligations',
        label:
          'Minimum debt payments, regular bills, and outside commitments compared with money available now',
      },
      { capability: 'dependents', label: 'Entered dependent records and review timing' },
    ],
    next: [
      'Insurance adequacy and coverage gaps',
      'Income interruption resilience beyond entered source records',
      'Beneficiary designations and document adequacy',
      'Dependent needs and unrecorded fixed obligations',
    ],
  },
  provision: {
    label: 'Provision',
    icon: Wallet,
    description: 'Whether money coming in can comfortably cover your bills and spending.',
    sources: ['Budgets', 'Transactions', 'Recurring bills'],
    observed: [
      { capability: 'budgets', label: 'Budget pace and overspending' },
      { capability: 'cashflow', label: 'Money coming in and going out' },
      { capability: 'recurring', label: 'Upcoming recurring bills' },
    ],
    next: ['Income stability', 'Essential expense coverage', 'Recurring-payment reliability'],
  },
  preparation: {
    label: 'Preparation',
    icon: Hammer,
    description:
      'How ready your household is for costs and responsibilities you already know are coming.',
    sources: ['User-entered planned expenses'],
    observed: [{ capability: 'planned-expenses', label: 'Recorded future expense due dates' }],
    next: [
      'Goals and sinking funds',
      'Funds set aside for planned expenses',
      'Home and vehicle maintenance',
      'Replacement planning',
    ],
  },
  prosperity: {
    label: 'Prosperity',
    icon: TrendingUp,
    description: 'Whether what you own and owe is moving in a healthy direction over time.',
    sources: ['Account balances', 'Transactions', 'Debt profiles'],
    observed: [
      { capability: 'accounts', label: 'What you own minus what you owe' },
      { capability: 'debt', label: 'Debt obligations and payoff progress' },
    ],
    next: ['Net-worth history', 'Savings rate', 'Investment progress', 'Interest burden'],
  },
  peace: {
    label: 'Peace',
    icon: PiggyBank,
    description:
      'A simple summary based on the area that needs the most help and any recent changes.',
    sources: ['Readiness pillar scores', 'Readiness snapshots'],
    observed: [],
    next: [
      'Better explanations of the upstream pillars',
      'Data freshness and confidence rules',
      'Meaningful score-change reasons',
    ],
  },
};

function scoreColor(score: number) {
  if (score >= 95) return 'var(--accent-green)';
  if (score >= 80) return 'var(--accent-blue)';
  if (score >= 60) return 'var(--accent-yellow)';
  if (score >= 40) return 'var(--accent-orange)';
  return 'var(--accent-red)';
}

function confidenceLabel(coverage: number, staleAccounts = 0) {
  if (staleAccounts > 0) return 'Some account info may be out of date';
  if (coverage >= 75) return 'Most of your picture is filled in';
  if (coverage >= 40) return 'Some of your picture is filled in';
  if (coverage > 0) return 'Just a little information so far';
  return 'Not enough information yet';
}

function signalColor(type: Signal['type']) {
  return type === 'risk'
    ? 'var(--accent-red)'
    : type === 'warning'
      ? 'var(--accent-amber)'
      : 'var(--accent-green)';
}

export default function ReadinessPillarPage() {
  const params = useParams<{ pillar: string }>();
  const pillar = params.pillar as PillarKey;
  const meta = PILLARS[pillar];
  const readinessQuery = useQuery({
    queryKey: ['readiness-explanation'],
    queryFn: () => apiClient.get<ReadinessExplanation>('/readiness/explain'),
  });

  if (!meta) {
    return (
      <div className="card text-center py-12">
        <p className="text-content-secondary">This readiness area does not exist.</p>
        <Link href="/dashboard" className="btn-secondary mt-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (readinessQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40" />
        <div className="card">
          <div className="skeleton h-48 w-full" />
        </div>
      </div>
    );
  }

  if (readinessQuery.isError) {
    return (
      <div className="card text-center py-12">
        <p className="text-content-secondary">Unable to load this readiness area.</p>
        <Link href="/dashboard" className="btn-secondary mt-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const data = readinessQuery.data!;
  const explanation = data.pillars.find((item) => item.pillar === pillar)!;
  const assessment = explanation.assessment;
  const score = assessment.score ?? 0;
  const coverage = assessment.coverage;
  const signals = explanation.factors;
  const observedCapabilities = new Set(signals.map((signal) => signal.capabilityId));
  const trend = data.recentChanges.find((change) => change.pillar === pillar);
  const pillarTrend = data.pillarTrends[pillar];
  const Icon = meta.icon;
  const color = scoreColor(score);

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="btn-ghost text-xs w-fit">
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      <section className="card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-3">
            <Icon size={24} style={{ color }} className="mt-1 flex-shrink-0" />
            <div>
              <p className="card-title">THIS PART OF YOUR HOUSEHOLD PICTURE</p>
              <h1 className="text-page-title">{meta.label}</h1>
              <p className="text-content-secondary max-w-2xl">{meta.description}</p>
            </div>
          </div>
          <div className="md:text-right">
            <p className="text-4xl font-bold" style={{ color }}>
              {assessment.score === null ? '—' : `${score}%`}
            </p>
            <p
              className={`text-sm mt-1 ${data.dataFreshness.staleAccounts > 0 ? 'text-accent-yellow' : 'text-content-secondary'}`}
            >
              {confidenceLabel(coverage, data.dataFreshness.staleAccounts)} · Wardkeep can check{' '}
              {coverage}% of this area
            </p>
            {trend && (
              <>
                <p
                  className={`text-xs mt-2 ${trend.delta >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                >
                  {trend.delta >= 0 ? '↑' : '↓'} {Math.abs(trend.delta)}{' '}
                  {data.changeWindow === 'since_last_visit'
                    ? 'since your last visit'
                    : 'since the previous recorded check'}
                </p>
                {trend.reason && (
                  <p className="text-xs mt-1 text-content-tertiary">{trend.reason}</p>
                )}
              </>
            )}
            {!trend && pillarTrend && (
              <p
                className={`text-xs mt-2 ${
                  pillarTrend.direction === 'improving'
                    ? 'text-accent-green'
                    : pillarTrend.direction === 'declining'
                      ? 'text-accent-red'
                      : 'text-content-tertiary'
                }`}
              >
                {pillarTrend.label}
                {pillarTrend.elapsedDays ? ` over ${pillarTrend.elapsedDays} recorded days` : ''}
              </p>
            )}
          </div>
        </div>
      </section>

      {assessment.state === 'not_evaluated' ? (
        <section className="card border-[var(--accent-yellow)]">
          <div className="flex gap-3">
            <CircleHelp size={20} className="text-accent-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-content-primary">
                Wardkeep needs a little more information here
              </h2>
              <p className="text-sm text-content-secondary mt-1">
                Add a few details in this area before Wardkeep shows a score. It will not guess or
                make it look like everything is covered when it is not.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2 className="card-title">WHAT IS AFFECTING THIS</h2>
          {signals.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              No current factors were returned for this area.
            </p>
          ) : (
            <ul className="space-y-4">
              {signals.map((signal, index) => (
                <li key={`${signal.capabilityId}-${index}`} className="flex gap-3">
                  <AlertTriangle
                    size={17}
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: signalColor(signal.type) }}
                  />
                  <div>
                    <p className="text-sm text-content-primary">{signal.summary}</p>
                    <p className="text-xs text-content-tertiary mt-1">
                      {signal.provenance
                        ? `Based on: ${signal.provenance.sources.join(' · ')}`
                        : `${signal.capabilityId.replace(/-/g, ' ')} · current calculation`}
                    </p>
                    {signal.provenance && (
                      <>
                        <p
                          className={`text-xs mt-1 ${signal.provenance.evidenceState === 'stale' ? 'text-accent-yellow' : 'text-content-secondary'}`}
                        >
                          Info status: {signal.provenance.evidenceState.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-content-secondary mt-1">
                          {signal.provenance.method}
                        </p>
                        <p className="text-xs text-content-tertiary mt-1">
                          What this cannot tell you: {signal.provenance.limitation}
                        </p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pillar === 'protection' && (
        <section className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-content-primary">
              Keep policy details current
            </h2>
            <p className="text-sm text-content-secondary mt-1">
              Add renewal dates and deductibles so Wardkeep can flag upcoming renewals and compare
              recorded out-of-pocket costs with money available now.
            </p>
          </div>
          <Link href="/insurance" className="btn-primary whitespace-nowrap">
            Review policies
          </Link>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">INFORMATION USED</h2>
        {meta.sources.length === 0 ? (
          <p className="text-sm text-content-tertiary">
            Wardkeep does not have information for this area yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              Wardkeep used: {meta.sources.join(' · ')}.
            </p>
            <p className="text-xs text-content-tertiary mt-3">
              Last checked {new Date(data.evaluatedAt).toLocaleString()}. Accounts:{' '}
              {data.dataFreshness.synchronizedAccounts} synchronized ·{' '}
              {data.dataFreshness.manualAccounts} manual
              {data.dataFreshness.staleAccounts > 0
                ? ` · ${data.dataFreshness.staleAccounts} may be outdated`
                : ''}
              .
            </p>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <h2 className="card-title">WHAT WARDKEEP CAN CHECK</h2>
          {meta.observed.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              There is not enough information to check anything in this area yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {meta.observed.map((factor) => (
                <li key={factor.capability} className="flex gap-2 text-sm">
                  <CheckCircle2
                    size={16}
                    className={
                      observedCapabilities.has(factor.capability)
                        ? 'text-accent-green'
                        : 'text-content-tertiary'
                    }
                  />
                  <span className="text-content-primary">{factor.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">WHAT WOULD MAKE THIS MORE USEFUL</h2>
          <ul className="space-y-3">
            {explanation.notEvaluated.map((factor) => (
              <li key={factor.id} className="flex gap-2 text-sm">
                <CircleHelp size={16} className="text-content-tertiary flex-shrink-0" />
                <span className="text-content-secondary">{factor.label}</span>
              </li>
            ))}
          </ul>
          {meta.next.length > 0 && (
            <p className="text-xs text-content-tertiary mt-4">
              Wardkeep may add these checks later: {meta.next.join(' · ')}.
            </p>
          )}
          <p className="text-xs text-content-tertiary mt-4">
            This is based only on the items Wardkeep can check today. It will be clearer about when
            each kind of information was last updated as more connections are added.
          </p>
        </section>
      </div>
    </div>
  );
}
