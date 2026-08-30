'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  evaluatedAt: string;
  modelVersion: number;
  overall: number;
  pillars: PillarScores;
  signals: Signal[];
  topRisks: Signal[];
  topOpportunities: Signal[];
  history: Array<{ overall: number; pillars: PillarScores; recordedAt: string; modelVersion: number }>;
  trendWindows: Array<{
    days: 7 | 30 | 90;
    delta: number | null;
    comparedTo: string | null;
    elapsedDays: number | null;
  }>;
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

interface IncomeSourceSummary {
  id: string;
  name: string;
  nextExpectedDate: string | null;
  expectedNetAmount: string | null;
}
interface SpendingStatsSummary {
  monthlyTrend: Array<{ month: string; income: number; expenses: number }>;
  categoryChanges: Array<{
    categoryId: string | null;
    name: string;
    amount: number;
    previousAmount: number;
    change: number;
  }>;
}
interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  href: string;
}

interface Recommendation {
  id: string;
  signalSummary: string;
  action: string;
  actionHref: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: 'critical' | 'high' | 'medium' | 'low';
  priorityExplanation: string;
  confidence: string;
  supportingData: string[];
  relevanceDate: string | null;
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
  if (staleAccounts > 0) return 'Some account info may be out of date';
  if (coverage >= 75) return 'Most of your picture is filled in';
  if (coverage >= 40) return 'Some of your picture is filled in';
  if (coverage > 0) return 'Just a little information so far';
  return 'Not enough information yet';
}

const PILLAR_META: Record<string, { label: string; icon: typeof Shield; description: string }> = {
  protection: {
    label: 'Protection',
    icon: Shield,
    description: 'Money for surprises, insurance, and backup plans',
  },
  provision: {
    label: 'Provision',
    icon: Wallet,
    description: 'Day-to-day money, bills, and spending plan',
  },
  preparation: {
    label: 'Preparation',
    icon: Hammer,
    description: 'Upcoming costs, upkeep, and plans',
  },
  prosperity: {
    label: 'Prosperity',
    icon: TrendingUp,
    description: 'What you own, what you owe, and long-term progress',
  },
  peace: {
    label: 'Peace',
    icon: PiggyBank,
    description: 'A summary of how steady things look overall',
  },
};

const SIGNAL_ACTIONS: Record<string, { href: string; label: string }> = {
  'emergency-fund': { href: '/accounts', label: 'Review money available now' },
  insurance: { href: '/insurance', label: 'Review policies' },
  'insurance-record-details': { href: '/insurance', label: 'Complete policy details' },
  'insurance-deductibles': { href: '/insurance', label: 'Review deductibles' },
  'estate-documents': { href: '/estate-documents', label: 'Review estate plans' },
  'income-sources': { href: '/income-sources', label: 'Review income sources' },
  'secondary-liquidity': { href: '/accounts', label: 'Review available credit' },
  'fixed-obligations': { href: '/external-commitments', label: 'Review external commitments' },
  dependents: { href: '/dependents', label: 'Review dependents' },
  'planned-expenses': { href: '/planned-expenses', label: 'Review planned expenses' },
  budgets: { href: '/budget', label: 'Review budget' },
  cashflow: { href: '/dashboard/details', label: 'Review money flow' },
  recurring: { href: '/recurring', label: 'Review recurring bills' },
  accounts: { href: '/accounts', label: 'Review accounts' },
  debt: { href: '/debt', label: 'Review debt' },
};

function signalAction(signal: Signal): { href: string; label: string } {
  return (
    SIGNAL_ACTIONS[signal.capabilityId] ?? {
      href: `/dashboard/readiness/${signal.pillar}`,
      label: 'See what affects this',
    }
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [trendRange, setTrendRange] = useState<7 | 30 | 90>(30);
  const readinessQuery = useQuery({
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessResponse>('/readiness'),
  });
  const insuranceQuery = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: () => apiClient.get<InsurancePolicySummary[]>('/insurance/policies'),
  });
  const incomeSourcesQuery = useQuery({
    queryKey: ['income-sources'],
    queryFn: () => apiClient.get<IncomeSourceSummary[]>('/income-sources'),
  });
  const spendingStatsQuery = useQuery({
    queryKey: ['spending-stats'],
    queryFn: () => apiClient.get<SpendingStatsSummary>('/transactions/stats'),
  });
  const timelineQuery = useQuery({
    queryKey: ['timeline', 30],
    queryFn: () => apiClient.get<TimelineEvent[]>('/timeline/upcoming?days=30'),
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
  const selectedTrendWindow = data.trendWindows.find((trend) => trend.days === trendRange) ?? {
    days: trendRange,
    delta: null,
    comparedTo: null,
    elapsedDays: null,
  };
  const canCompareTrend =
    data.overallAssessment.state !== 'not_evaluated' &&
    observedOverall !== null &&
    selectedTrendWindow?.delta !== null &&
    selectedTrendWindow.comparedTo !== null &&
    selectedTrendWindow.elapsedDays !== null;
  const visibleTrendHistory = canCompareTrend
    ? [
        ...history.filter(
          (point) =>
            new Date(point.recordedAt).getTime() >=
            new Date(selectedTrendWindow.comparedTo!).getTime(),
        ),
        { overall: observedOverall!, pillars: data.pillars, recordedAt: data.evaluatedAt },
      ]
    : [];
  const activeRecommendations = (recommendationsQuery.data ?? [])
    .filter((recommendation) => recommendation.status === 'ACTIVE')
    .slice(0, 3);
  const [recommendedNextStep, ...additionalRecommendations] = activeRecommendations;
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
  const comingUp = (timelineQuery.data ?? []).slice(0, 5);
  const nextExpectedIncome = (incomeSourcesQuery.data ?? [])
    .filter((source) => source.nextExpectedDate && daysUntil(source.nextExpectedDate) >= 0)
    .sort(
      (a, b) => new Date(a.nextExpectedDate!).getTime() - new Date(b.nextExpectedDate!).getTime(),
    )[0];
  const recentSpending = spendingStatsQuery.data?.monthlyTrend.slice(-2) ?? [];
  const currentSpending = recentSpending[1];
  const previousSpending = recentSpending[0];
  const spendingDelta =
    currentSpending && previousSpending
      ? currentSpending.expenses - previousSpending.expenses
      : null;
  const largestCategoryChange = spendingStatsQuery.data?.categoryChanges[0];
  const recordedNet = currentSpending ? currentSpending.income - currentSpending.expenses : null;
  const savingsRate =
    currentSpending && currentSpending.income > 0 ? recordedNet! / currentSpending.income : null;

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
            <h2 className="text-xl font-semibold text-content-primary mb-1">Your household picture</h2>
            <p className="text-sm text-content-secondary">
              {observedOverall === null ? (
                'Add your accounts and everyday spending so Wardkeep can give you a useful picture.'
              ) : (
                <>
                  {strongest && (
                    <>
                      Looking strongest:{' '}
                      <span className="text-content-primary">
                        {PILLAR_META[strongest[0]]?.label} {strongest[1]}
                      </span>
                      .{' '}
                    </>
                  )}
                  {weakest && (
                    <>
                      Needs the most attention:{' '}
                      <span className="text-content-primary">
                        {PILLAR_META[weakest[0]]?.label} {weakest[1]}
                      </span>
                      .{' '}
                    </>
                  )}
                  {data.overallAssessment.state === 'partial'
                    ? 'Wardkeep is still missing some information.'
                    : 'This is based on the information you have added so far.'}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-content-tertiary">
              <span className={data.dataFreshness.staleAccounts > 0 ? 'text-accent-yellow' : ''}>
                {coverageLabel(data.coverage, data.dataFreshness.staleAccounts)} · Wardkeep has{' '}
                {data.coverage}% of the information it checks
              </span>
              <span className={data.dataFreshness.staleAccounts > 0 ? 'text-accent-yellow' : ''}>
                {data.dataFreshness.staleAccounts > 0
                  ? `${data.dataFreshness.staleAccounts} account${data.dataFreshness.staleAccounts === 1 ? '' : 's'} may be outdated`
                  : `${data.dataFreshness.synchronizedAccounts} synced · ${data.dataFreshness.manualAccounts} manual`}
              </span>
              <span>Readiness model v{data.modelVersion}</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-1" aria-label="Readiness trend range">
                {([7, 30, 90] as const).map((days) => {
                  const isSelected = trendRange === days;
                  const isAvailable = data.trendWindows.some(
                    (trend) => trend.days === days && trend.delta !== null,
                  );
                  return (
                    <button
                      type="button"
                      key={days}
                      onClick={() => setTrendRange(days)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-accent-blue text-white'
                          : 'text-content-tertiary hover:bg-surface-tertiary hover:text-content-primary'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {days}d{!isAvailable ? ' ·' : ''}
                    </button>
                  );
                })}
              </div>
              {canCompareTrend ? (
                <>
                  {data.overallAssessment.state === 'partial' && (
                    <p className="mt-2 text-xs text-content-tertiary">
                      How this picture has changed based on what Wardkeep can check so far.
                    </p>
                  )}
                  <p
                    className={`text-xs font-medium ${
                      data.overallAssessment.state === 'partial' ? 'mt-1' : 'mt-2'
                    } ${selectedTrendWindow.delta! >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                  >
                    {selectedTrendWindow.delta! >= 0 ? '↑' : '↓'}{' '}
                    {Math.abs(selectedTrendWindow.delta!)} over {selectedTrendWindow.elapsedDays}{' '}
                    days
                  </p>
                  <svg
                    viewBox="0 0 180 36"
                    className="w-full max-w-xs h-9 mt-2"
                    aria-label={`${trendRange}-day readiness trend`}
                  >
                    <polyline
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={visibleTrendHistory
                        .map(
                          (point, index) =>
                            `${(index / (visibleTrendHistory.length - 1)) * 180},${34 - point.overall * 0.32}`,
                        )
                        .join(' ')}
                    />
                  </svg>
                </>
              ) : (
                <p className="mt-2 text-xs text-content-tertiary">
                  No recorded comparison is available for this period yet.
                </p>
              )}
            </div>
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
                  ? 'Based on the other areas above'
                  : `${coverageLabel(coverage, data.dataFreshness.staleAccounts)} · Wardkeep can check ${coverage}% here`}
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

      {recommendedNextStep && (
        <section className="card mb-6 border-accent-blue/30 bg-accent-blue/5">
          <p className="card-title text-accent-blue">Recommended next step</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-content-primary">
                {recommendedNextStep.signalSummary}
              </h2>
              <p className="mt-1 text-sm text-content-secondary">
                {recommendedNextStep.impactPreview}
              </p>
              <p className="mt-2 text-xs text-content-tertiary">
                How serious: {recommendedNextStep.severity} · Needs attention: {recommendedNextStep.priority} · Info quality: {Math.round(Number(recommendedNextStep.confidence) * 100)}%
                {recommendedNextStep.relevanceDate
                  ? ` · relevant by ${new Date(recommendedNextStep.relevanceDate).toLocaleDateString()}`
                  : ''}
              </p>
              {recommendedNextStep.priorityExplanation && (
                <p className="mt-1 text-xs text-content-tertiary">
                  Why this is suggested: {recommendedNextStep.priorityExplanation}
                </p>
              )}
              {recommendedNextStep.supportingData.length > 0 && (
                <details className="mt-1 text-xs text-content-tertiary">
                  <summary className="cursor-pointer">Supporting data</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {recommendedNextStep.supportingData.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={recommendedNextStep.actionHref} className="btn-primary text-sm">
                {recommendedNextStep.action}
              </Link>
              <button
                onClick={() =>
                  updateRecommendationMutation.mutate({
                    id: recommendedNextStep.id,
                    status: 'COMPLETED',
                  })
                }
                className="btn-ghost p-2 text-content-tertiary hover:text-accent-green"
                title="Mark recommendation complete"
                aria-label="Mark recommendation complete"
              >
                <Check size={15} />
              </button>
            </div>
          </div>
        </section>
      )}

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

      {!incomeSourcesQuery.isLoading && (
        <section className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-content-primary">Next expected income</h2>
            {nextExpectedIncome?.nextExpectedDate ? (
              <p className="mt-1 text-sm text-content-secondary">
                {nextExpectedIncome.name} ·{' '}
                {new Date(nextExpectedIncome.nextExpectedDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                })}
                {nextExpectedIncome.expectedNetAmount
                  ? ` · $${Number(nextExpectedIncome.expectedNetAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : ''}
              </p>
            ) : (
              <p className="mt-1 text-sm text-content-secondary">
                No next expected income date recorded.
              </p>
            )}
            <p className="mt-1 text-xs text-content-tertiary">
              Recorded household planning context; not a predicted paycheck.
            </p>
          </div>
          <Link href="/income-sources" className="btn-secondary whitespace-nowrap">
            Review income
          </Link>
        </section>
      )}

      {!spendingStatsQuery.isLoading && currentSpending && (
        <section className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-content-primary">
              This month’s recorded spending
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              $
              {currentSpending.expenses.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {spendingDelta === null
                ? ''
                : ` · ${spendingDelta >= 0 ? '$' : '-$'}${Math.abs(spendingDelta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${spendingDelta >= 0 ? 'more' : 'less'} than last month`}
            </p>
            {recordedNet !== null && (
              <p
                className={`mt-1 text-xs ${recordedNet >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
              >
                Recorded net: {recordedNet >= 0 ? '+' : '-'}$
                {Math.abs(recordedNet).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {savingsRate !== null
                  ? ` · ${(savingsRate * 100).toFixed(0)}% of recorded income`
                  : ''}
              </p>
            )}
            {largestCategoryChange && (
              <p className="mt-1 text-xs text-content-secondary">
                Largest category change: {largestCategoryChange.name} ·{' '}
                {largestCategoryChange.change >= 0 ? '$' : '-$'}
                {Math.abs(largestCategoryChange.change).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
            <p className="mt-1 text-xs text-content-tertiary">
              Based on recorded debit and credit transactions; incomplete imports can change the
              comparison.
            </p>
          </div>
          <Link href="/dashboard/details" className="btn-secondary whitespace-nowrap">
            View trends
          </Link>
        </section>
      )}

      {/* Action-oriented next steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-title">Needs attention</h3>
          {data.topRisks.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              Nothing needs attention from the information Wardkeep has so far. Adding more details can make this more useful.
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
          <h3 className="card-title">More recommended actions</h3>
          {recommendationsQuery.isLoading ? (
            <p className="text-sm text-content-tertiary">Updating your recommendations…</p>
          ) : additionalRecommendations.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              {recommendationsQuery.isError
                ? 'Recommendations are unavailable right now. Review the readiness factors above for current next steps.'
                : recommendedNextStep
                  ? 'No additional actions need attention right now.'
                  : 'No active recommendations right now. Add more household information for a broader assessment.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {additionalRecommendations.map((recommendation) => {
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
                        How serious: {recommendation.severity} · Needs attention: {recommendation.priority} · Info quality: {Math.round(Number(recommendation.confidence) * 100)}%
                      </p>
                      {recommendation.relevanceDate && (
                        <p className="mt-0.5 text-xs text-content-secondary">
                          Relevant by {new Date(recommendation.relevanceDate).toLocaleDateString()}.
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-content-tertiary">
                        Assumption: {recommendation.assumptions}
                      </p>
                      {recommendation.priorityExplanation && (
                        <p className="mt-0.5 text-xs text-content-tertiary">
                          Why this is suggested: {recommendation.priorityExplanation}
                        </p>
                      )}
                      {recommendation.supportingData.length > 0 && (
                        <details className="mt-1 text-xs text-content-tertiary">
                          <summary className="cursor-pointer">Supporting data</summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {recommendation.supportingData.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </details>
                      )}
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
            No changes in this picture have been recorded yet.
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
          Compared with the nearest daily check-in Wardkeep has for this period. Wardkeep explains
          a change when it can connect it to information you entered.
        </p>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="card-title">COMING UP</h3>
            <p className="text-xs text-content-tertiary">Recorded dates in the next 30 days</p>
          </div>
          <Link
            href="/timeline"
            className="flex items-center gap-2 text-xs text-accent-blue hover:underline"
          >
            View timeline
            <CalendarDays size={19} />
          </Link>
        </div>
        {timelineQuery.isLoading ? (
          <div className="skeleton mt-4 h-16 w-full" />
        ) : comingUp.length === 0 ? (
          <p className="mt-4 text-sm text-content-tertiary">
            No upcoming recorded bills, income dates, planned expenses, or policy renewals in the
            next 30 days.
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
