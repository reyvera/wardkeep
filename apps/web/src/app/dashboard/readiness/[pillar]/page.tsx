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

interface PillarScores {
  protection: number;
  provision: number;
  preparation: number;
  prosperity: number;
  peace: number;
}

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

interface ReadinessResponse {
  evaluatedAt: string;
  pillars: PillarScores;
  signals: Signal[];
  history: Array<{ pillars: PillarScores; recordedAt: string }>;
  coverage: number;
  pillarCoverage: Record<'protection' | 'provision' | 'preparation' | 'prosperity', number>;
  pillarAssessments: Record<
    PillarKey,
    {
      state: 'known' | 'partial' | 'not_evaluated';
      score: number | null;
      coverage: number;
      evaluatedCapabilities: string[];
    }
  >;
  dataFreshness: {
    synchronizedAccounts: number;
    manualAccounts: number;
    staleAccounts: number;
    lastSynchronizedAt: string | null;
  };
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
    description: 'How well the household can absorb a financial shock.',
    sources: ['Account balances', 'Recent debit transactions', 'Insurance, estate-planning, and income-source records'],
    observed: [
      { capability: 'emergency-fund', label: 'Liquid reserves and ordinary expense coverage' },
      { capability: 'insurance', label: 'Entered insurance policies and renewal timing' },
      {
        capability: 'insurance-deductibles',
        label: 'Recorded deductibles compared with liquid reserves',
      },
      { capability: 'estate-documents', label: 'Entered estate-planning records and review timing' },
      { capability: 'income-sources', label: 'Entered income sources and review timing' },
      { capability: 'secondary-liquidity', label: 'Recorded available credit when nearly exhausted' },
    ],
    next: [
      'Insurance adequacy and coverage gaps',
      'Income interruption resilience beyond entered source records',
      'Beneficiary designations and document adequacy',
      'Dependents and fixed obligations',
    ],
  },
  provision: {
    label: 'Provision',
    icon: Wallet,
    description: 'Whether day-to-day income, bills, and spending are sustainable.',
    sources: ['Budgets', 'Transactions', 'Recurring bills'],
    observed: [
      { capability: 'budgets', label: 'Budget pace and overspending' },
      { capability: 'cashflow', label: 'Cash-flow forecast' },
      { capability: 'recurring', label: 'Upcoming recurring bills' },
    ],
    next: ['Income stability', 'Essential expense coverage', 'Recurring-payment reliability'],
  },
  preparation: {
    label: 'Preparation',
    icon: Hammer,
    description: 'How ready the household is for known future costs and responsibilities.',
    sources: [],
    observed: [],
    next: [
      'Goals and sinking funds',
      'Known future expenses and taxes',
      'Home and vehicle maintenance',
      'Replacement planning',
    ],
  },
  prosperity: {
    label: 'Prosperity',
    icon: TrendingUp,
    description: 'Whether the household’s long-term financial position is improving.',
    sources: ['Account balances', 'Transactions', 'Debt profiles'],
    observed: [
      { capability: 'accounts', label: 'Net-worth position' },
      { capability: 'debt', label: 'Debt obligations and payoff progress' },
    ],
    next: ['Net-worth history', 'Savings rate', 'Investment progress', 'Interest burden'],
  },
  peace: {
    label: 'Peace',
    icon: PiggyBank,
    description:
      'A derived indicator of stability, based on the least-ready observed area and recent score movement.',
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
  if (staleAccounts > 0) return 'Freshness needs review';
  if (coverage >= 75) return 'High confidence';
  if (coverage >= 40) return 'Moderate confidence';
  if (coverage > 0) return 'Limited confidence';
  return 'Not evaluated';
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
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessResponse>('/readiness'),
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
  const assessment = data.pillarAssessments[pillar];
  const score = assessment.score ?? data.pillars[pillar];
  const coverage = assessment.coverage;
  const signals = data.signals.filter((signal) => signal.pillar === pillar);
  const observedCapabilities = new Set(signals.map((signal) => signal.capabilityId));
  const history = data.history.slice(-90);
  const trend = history.length > 1 ? score - history[0]!.pillars[pillar] : null;
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
              <p className="card-title">READINESS PILLAR</p>
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
              {confidenceLabel(coverage, data.dataFreshness.staleAccounts)} · {coverage}% coverage
            </p>
            {trend !== null && (
              <p className={`text-xs mt-2 ${trend >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} over available history
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
                This area has not been evaluated yet
              </h2>
              <p className="text-sm text-content-secondary mt-1">
                Wardkeep does not have a generator for {meta.label.toLowerCase()} yet, so it will
                not present a score as if the household were prepared.
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
                        ? `Sources: ${signal.provenance.sources.join(' · ')}`
                        : `${signal.capabilityId.replace(/-/g, ' ')} · current calculation`}
                    </p>
                    {signal.provenance && (
                      <>
                        <p
                          className={`text-xs mt-1 ${signal.provenance.evidenceState === 'stale' ? 'text-accent-yellow' : 'text-content-secondary'}`}
                        >
                          Evidence: {signal.provenance.evidenceState.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-content-secondary mt-1">
                          {signal.provenance.method}
                        </p>
                        <p className="text-xs text-content-tertiary mt-1">
                          Limit: {signal.provenance.limitation}
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
              recorded out-of-pocket costs with liquid reserves.
            </p>
          </div>
          <Link href="/insurance" className="btn-primary whitespace-nowrap">
            Review policies
          </Link>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">DATA USED</h2>
        {meta.sources.length === 0 ? (
          <p className="text-sm text-content-tertiary">
            No source data is connected to this pillar yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              This assessment was calculated from: {meta.sources.join(' · ')}.
            </p>
            <p className="text-xs text-content-tertiary mt-3">
              Evaluated {new Date(data.evaluatedAt).toLocaleString()}. Account sources:{' '}
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
          <h2 className="card-title">EVALUATED FACTORS</h2>
          {meta.observed.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              No direct factors are evaluated in this pillar yet.
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
          <h2 className="card-title">STILL NEEDED FOR A COMPLETE PICTURE</h2>
          <ul className="space-y-3">
            {meta.next.map((factor) => (
              <li key={factor} className="flex gap-2 text-sm">
                <CircleHelp size={16} className="text-content-tertiary flex-shrink-0" />
                <span className="text-content-secondary">{factor}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-content-tertiary mt-4">
            Coverage reflects currently evaluated factors. More source-specific freshness rules are
            still being defined.
          </p>
        </section>
      </div>
    </div>
  );
}
