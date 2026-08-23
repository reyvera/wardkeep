'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Shield,
  TrendingUp,
  Wallet,
  PiggyBank,
  Hammer,
  AlertTriangle,
  Lightbulb,
  Activity,
  BarChart3,
  Check,
  X,
  CalendarDays,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  pillar: string;
  summary: string;
  weight?: number;
}

interface ReadinessResponse {
  overall: number;
  pillars: PillarScores;
  signals: Signal[];
  topRisks: Signal[];
  topOpportunities: Signal[];
  history: Array<{ overall: number; pillars: PillarScores; recordedAt: string }>;
  overallAssessment: {
    state: 'known' | 'partial' | 'not_evaluated';
    score: number | null;
    coverage: number;
    evaluatedCapabilities: string[];
  };
  coverage: number;
  pillarCoverage: Record<'protection' | 'provision' | 'preparation' | 'prosperity', number>;
  pillarAssessments: Record<
    string,
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
  recentChanges: Array<{
    pillar: string;
    previous: number;
    current: number;
    delta: number;
    comparedTo: string;
    reason: string | null;
  }>;
  changeWindow: 'since_last_visit' | 'since_last_snapshot' | 'none';
}

interface InsurancePolicySummary {
  id: string;
  provider: string;
  type: string;
  renewalDate: string | null;
  deductible: string | null;
  coverageAmount: string | null;
  isActive: boolean;
}

interface RecurringTransactionSummary {
  id: string;
  merchant: string;
  expectedAmount: string;
  frequency: string;
  nextExpected: string;
}

interface Recommendation {
  id: string;
  signalSummary: string;
  action: string;
  actionHref: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assumptions: string;
  impactPreview: string;
  projectedPillarDelta: number | null;
  status: 'ACTIVE' | 'DISMISSED' | 'COMPLETED' | 'RESOLVED';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 95) return 'var(--accent-green)';
  if (score >= 80) return 'var(--accent-blue)';
  if (score >= 60) return 'var(--accent-yellow)';
  if (score >= 40) return 'var(--accent-orange)';
  return 'var(--accent-red)';
}

function getScoreLabel(score: number): string {
  if (score >= 95) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Attention';
  if (score >= 40) return 'Warning';
  return 'Critical';
}

function getSignalIcon(type: Signal['type']) {
  switch (type) {
    case 'risk':
      return AlertTriangle;
    case 'warning':
      return AlertTriangle;
    case 'opportunity':
      return Lightbulb;
    case 'positive':
      return TrendingUp;
    case 'milestone':
      return Activity;
  }
}

function getSignalColor(type: Signal['type']): string {
  switch (type) {
    case 'risk':
      return 'var(--accent-red)';
    case 'warning':
      return 'var(--accent-amber)';
    case 'opportunity':
      return 'var(--accent-blue)';
    case 'positive':
      return 'var(--accent-green)';
    case 'milestone':
      return 'var(--accent-green)';
  }
}

function coverageLabel(coverage: number, staleAccounts = 0): string {
  if (staleAccounts > 0) return 'Freshness needs review';
  if (coverage >= 75) return 'High confidence';
  if (coverage >= 40) return 'Moderate confidence';
  if (coverage > 0) return 'Limited confidence';
  return 'Not evaluated';
}

const PILLAR_META: Record<string, { label: string; icon: typeof Shield; description: string }> = {
  protection: {
    label: 'Protection',
    icon: Shield,
    description: 'Reserves, recorded policies, and shock resilience',
  },
  provision: {
    label: 'Provision',
    icon: Wallet,
    description: 'Cash flow, bills, budget adherence',
  },
  preparation: {
    label: 'Preparation',
    icon: Hammer,
    description: 'Maintenance, goals, planning',
  },
  prosperity: {
    label: 'Prosperity',
    icon: TrendingUp,
    description: 'Net worth, debt reduction, investments',
  },
  peace: {
    label: 'Peace',
    icon: PiggyBank,
    description: 'Overall stability indicator',
  },
};

const SIGNAL_ACTIONS: Record<string, { href: string; label: string }> = {
  'emergency-fund': { href: '/accounts', label: 'Review liquid accounts' },
  insurance: { href: '/insurance', label: 'Review policies' },
  'insurance-deductibles': { href: '/insurance', label: 'Review deductibles' },
  'estate-documents': { href: '/estate-documents', label: 'Review estate plans' },
  budgets: { href: '/budget', label: 'Review budget' },
  cashflow: { href: '/dashboard/details', label: 'Review cash flow' },
  recurring: { href: '/recurring', label: 'Review recurring bills' },
  accounts: { href: '/accounts', label: 'Review accounts' },
  debt: { href: '/debt', label: 'Review debt' },
};

function signalAction(signal: Signal): { href: string; label: string } {
  return (
    SIGNAL_ACTIONS[signal.capabilityId] ?? {
      href: `/dashboard/readiness/${signal.pillar}`,
      label: 'View readiness factor',
    }
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const readinessQuery = useQuery({
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessResponse>('/readiness'),
  });
  const insuranceQuery = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: () => apiClient.get<InsurancePolicySummary[]>('/insurance/policies'),
  });
  const recurringQuery = useQuery({
    queryKey: ['recurring-transactions'],
    queryFn: () => apiClient.get<RecurringTransactionSummary[]>('/recurring'),
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiClient.get<Recommendation[]>('/recommendations'),
    enabled: readinessQuery.isSuccess,
  });
  const updateRecommendationMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'COMPLETED' | 'DISMISSED' }) =>
      apiClient.patch(`/recommendations/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  if (readinessQuery.isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-page-title">Dashboard</h1>
          <Link href="/dashboard/details" className="btn-ghost text-xs">
            <BarChart3 size={14} />
            Spending Details
          </Link>
        </div>
        <div className="grid gap-6">
          <div className="card">
            <div className="skeleton h-32 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-20 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (readinessQuery.isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-page-title">Dashboard</h1>
          <Link href="/dashboard/details" className="btn-ghost text-xs">
            <BarChart3 size={14} />
            Spending Details
          </Link>
        </div>
        <div className="card text-center py-12">
          <p className="text-content-secondary">
            Unable to compute readiness. Make sure you have accounts and transactions set up.
          </p>
        </div>
      </div>
    );
  }

  const data = readinessQuery.data!;
  const observedOverall = data.overallAssessment.score;
  const scoreColor = getScoreColor(observedOverall ?? 0);
  const scoreLabel = observedOverall === null ? 'Unknown' : getScoreLabel(observedOverall);
  const scoredPillars = Object.entries(data.pillars).filter(
    ([key]) => key !== 'peace' && data.pillarAssessments[key]?.score !== null,
  );
  const strongest = scoredPillars.sort((a, b) => b[1] - a[1])[0];
  const weakest = scoredPillars.sort((a, b) => a[1] - b[1])[0];
  const history = data.history.slice(-90);
  const canCompareTrend =
    data.overallAssessment.state === 'known' && history.length > 1 && observedOverall !== null;
  const trendDelta = canCompareTrend ? observedOverall - history[0]!.overall : 0;
  const activeRecommendations = (recommendationsQuery.data ?? [])
    .filter((recommendation) => recommendation.status === 'ACTIVE')
    .slice(0, 3);
  const activePolicies = insuranceQuery.data?.filter((policy) => policy.isActive) ?? [];
  const policyDetailsNeeded = activePolicies.filter(
    (policy) => !policy.renewalDate || !policy.deductible || !policy.coverageAmount,
  ).length;
  const policyRenewalsNeedingAttention = activePolicies.filter((policy) => {
    if (!policy.renewalDate) return false;
    return new Date(policy.renewalDate).getTime() - Date.now() <= 30 * 86_400_000;
  }).length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (date: string) =>
    Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000);
  const comingUp = [
    ...activePolicies
      .filter((policy) => policy.renewalDate && daysUntil(policy.renewalDate) <= 30)
      .map((policy) => ({
        id: `policy-${policy.id}`,
        date: policy.renewalDate!,
        title: `${policy.provider} ${policy.type.toLowerCase().replace('_', ' ')} renewal`,
        detail: 'Recorded policy renewal',
        href: '/insurance',
      })),
    ...(recurringQuery.data ?? [])
      .filter(
        (transaction) =>
          daysUntil(transaction.nextExpected) >= 0 && daysUntil(transaction.nextExpected) <= 30,
      )
      .map((transaction) => ({
        id: `recurring-${transaction.id}`,
        date: transaction.nextExpected,
        title: transaction.merchant,
        detail: `$${Number(transaction.expectedAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} expected ${transaction.frequency.toLowerCase()}`,
        href: '/recurring',
      })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <div>
      {/* Header with link to detailed analytics */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-page-title">Dashboard</h1>
        <Link href="/dashboard/details" className="btn-ghost text-xs">
          <BarChart3 size={14} />
          Financial overview
        </Link>
      </div>

      {/* Overall score and explainable trend */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Score ring */}
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="8"
              />
              {observedOverall !== null && (
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${observedOverall * 2.64} 264`}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-content-primary">
                {observedOverall === null ? '—' : `${observedOverall}%`}
              </span>
              <span className="text-xs font-medium" style={{ color: scoreColor }}>
                {scoreLabel}
              </span>
            </div>
          </div>

          {/* Summary text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-semibold text-content-primary mb-1">Household readiness</h2>
            <p className="text-sm text-content-secondary">
              {observedOverall === null ? (
                'Add accounts and ordinary expenses before Wardkeep can assess your readiness.'
              ) : (
                <>
                  {strongest && (
                    <>
                      Strongest observed:{' '}
                      <span className="text-content-primary">
                        {PILLAR_META[strongest[0]]?.label} {strongest[1]}
                      </span>
                      .{' '}
                    </>
                  )}
                  {weakest && (
                    <>
                      Most limited observed:{' '}
                      <span className="text-content-primary">
                        {PILLAR_META[weakest[0]]?.label} {weakest[1]}
                      </span>
                      .{' '}
                    </>
                  )}
                  This is a {data.overallAssessment.state === 'partial' ? 'partial' : 'complete'}{' '}
                  assessment of the information currently available.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-content-tertiary">
              <span className={data.dataFreshness.staleAccounts > 0 ? 'text-accent-yellow' : ''}>
                {coverageLabel(data.coverage, data.dataFreshness.staleAccounts)} · {data.coverage}%
                coverage
              </span>
              <span className={data.dataFreshness.staleAccounts > 0 ? 'text-accent-yellow' : ''}>
                {data.dataFreshness.staleAccounts > 0
                  ? `${data.dataFreshness.staleAccounts} account${data.dataFreshness.staleAccounts === 1 ? '' : 's'} may be outdated`
                  : `${data.dataFreshness.synchronizedAccounts} synced · ${data.dataFreshness.manualAccounts} manual`}
              </span>
              {canCompareTrend && (
                <span className={trendDelta >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                  {trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta)} over 90 days
                </span>
              )}
            </div>
            {canCompareTrend && (
              <svg
                viewBox="0 0 180 36"
                className="w-full max-w-xs h-9 mt-3"
                aria-label="Readiness trend"
              >
                <polyline
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={history
                    .map(
                      (point, index) =>
                        `${(index / (history.length - 1)) * 180},${34 - point.overall * 0.32}`,
                    )
                    .join(' ')}
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {Object.entries(data.pillars).map(([key, score]) => {
          const meta = PILLAR_META[key];
          if (!meta) return null;
          const Icon = meta.icon;
          const color = getScoreColor(score);

          const assessment = data.pillarAssessments[key];
          const coverage = assessment?.coverage ?? 0;
          const pillarSignals = data.signals.filter((signal) => signal.pillar === key).slice(0, 2);
          return (
            <Link
              href={`/dashboard/readiness/${key}`}
              key={key}
              className="card block transition-colors hover:border-[var(--accent-blue)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color }} />
                <span className="text-sm font-medium text-content-primary">{meta.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold" style={{ color }}>
                  {assessment?.score === null || !assessment ? '—' : `${score}%`}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${assessment?.score === null ? 0 : score}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="text-xs text-content-tertiary mt-2">
                {key === 'peace'
                  ? 'Derived from observed pillars'
                  : `${coverageLabel(coverage, data.dataFreshness.staleAccounts)} · ${coverage}% covered`}
              </p>
              {pillarSignals.map((signal) => (
                <p
                  key={signal.capabilityId}
                  className="text-xs text-content-secondary mt-1 line-clamp-2"
                >
                  {signal.summary}
                </p>
              ))}
            </Link>
          );
        })}
      </div>

      {!insuranceQuery.isLoading && (
        <section className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Shield size={20} className="mt-0.5 text-accent-blue" />
            <div>
              <h2 className="text-base font-semibold text-content-primary">Policy records</h2>
              {activePolicies.length === 0 ? (
                <p className="mt-1 text-sm text-content-secondary">
                  No active policies recorded. Add the policies you want Wardkeep to track.
                </p>
              ) : (
                <p className="mt-1 text-sm text-content-secondary">
                  {activePolicies.length} active · {policyRenewalsNeedingAttention} renewal
                  {policyRenewalsNeedingAttention === 1 ? '' : 's'} needing attention ·{' '}
                  {policyDetailsNeeded} record{policyDetailsNeeded === 1 ? '' : 's'} missing key
                  details
                </p>
              )}
            </div>
          </div>
          <Link href="/insurance" className="btn-secondary whitespace-nowrap">
            Review policies
          </Link>
        </section>
      )}

      {/* Action-oriented next steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-title">Needs attention</h3>
          {data.topRisks.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              No confirmed risks yet. More household information improves this assessment.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.topRisks.map((signal, i) => {
                const Icon = getSignalIcon(signal.type);
                const color = getSignalColor(signal.type);
                const action = signalAction(signal);
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon size={16} className="mt-0.5 flex-shrink-0" style={{ color }} />
                    <div>
                      <p className="text-sm text-content-primary">{signal.summary}</p>
                      <Link
                        href={action.href}
                        className="mt-1 inline-block text-xs text-accent-blue hover:underline"
                      >
                        {action.label}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Wardkeep recommends</h3>
          {recommendationsQuery.isLoading ? (
            <p className="text-sm text-content-tertiary">Updating your recommendations…</p>
          ) : activeRecommendations.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              {recommendationsQuery.isError
                ? 'Recommendations are unavailable right now. Review the readiness factors above for current next steps.'
                : 'No active recommendations right now. Add more household information for a broader assessment.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {activeRecommendations.map((recommendation) => {
                const priorityColor =
                  recommendation.priority === 'critical'
                    ? 'var(--accent-red)'
                    : recommendation.priority === 'high'
                      ? 'var(--accent-orange)'
                      : recommendation.priority === 'medium'
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-blue)';
                return (
                  <li key={recommendation.id} className="flex items-start gap-3">
                    <Lightbulb
                      size={16}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: priorityColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-content-primary">
                        {recommendation.signalSummary}
                      </span>
                      <p className="text-xs text-content-tertiary mt-0.5">
                        {recommendation.priority} priority · {recommendation.assumptions}
                      </p>
                      <p className="mt-1 text-xs text-content-secondary">
                        {recommendation.impactPreview}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={recommendation.actionHref}
                          className="text-xs text-accent-blue hover:underline"
                        >
                          {recommendation.action}
                        </Link>
                        <button
                          onClick={() =>
                            updateRecommendationMutation.mutate({
                              id: recommendation.id,
                              status: 'COMPLETED',
                            })
                          }
                          className="btn-ghost p-1 text-content-tertiary hover:text-accent-green"
                          title="Mark recommendation complete"
                          aria-label="Mark recommendation complete"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() =>
                            updateRecommendationMutation.mutate({
                              id: recommendation.id,
                              status: 'DISMISSED',
                            })
                          }
                          className="btn-ghost p-1 text-content-tertiary hover:text-content-primary"
                          title="Dismiss recommendation"
                          aria-label="Dismiss recommendation"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="card-title">
          {data.changeWindow === 'since_last_visit'
            ? 'SINCE YOUR LAST VISIT'
            : 'SINCE YOUR LAST RECORDED CHECK'}
        </h3>
        {data.recentChanges.length === 0 ? (
          <p className="text-sm text-content-tertiary">
            No readiness changes have been recorded yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.recentChanges.map((change) => {
              const label = PILLAR_META[change.pillar]?.label ?? change.pillar;
              return (
                <li key={change.pillar} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="text-content-primary">
                      {label} changed from {change.previous} to {change.current}
                    </p>
                    {change.reason && (
                      <p className="text-xs text-content-tertiary mt-1">{change.reason}</p>
                    )}
                  </div>
                  <span
                    className={
                      change.delta > 0
                        ? 'text-accent-green font-medium'
                        : 'text-accent-red font-medium'
                    }
                  >
                    {change.delta > 0 ? '↑' : '↓'} {Math.abs(change.delta)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-content-tertiary mt-4">
          Compared with the closest daily readiness snapshot available for this period. Detailed
          score-change reasons are still being added.
        </p>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="card-title">COMING UP</h3>
            <p className="text-xs text-content-tertiary">Recorded dates in the next 30 days</p>
          </div>
          <CalendarDays size={19} className="text-accent-blue" />
        </div>
        {recurringQuery.isLoading || insuranceQuery.isLoading ? (
          <div className="skeleton mt-4 h-16 w-full" />
        ) : comingUp.length === 0 ? (
          <p className="mt-4 text-sm text-content-tertiary">
            No upcoming recorded bills or policy renewals in the next 30 days.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {comingUp.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <p className="text-content-primary">{event.title}</p>
                  <p className="mt-0.5 text-xs text-content-tertiary">{event.detail}</p>
                </div>
                <Link
                  href={event.href}
                  className="whitespace-nowrap text-xs text-accent-blue hover:underline"
                >
                  {new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
