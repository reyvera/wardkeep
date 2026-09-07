'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Check, Lightbulb, Sun, WalletCards, X } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface MorningBrief {
  greeting: string;
  readiness: { score: number | null; state: 'known' | 'partial' | 'not_evaluated'; coverage: number };
  priority: { id?: string; summary: string; action: string; href: string } | null;
  currentRisk: string | null;
  observations?: Array<{ kind: 'budget_warning' | 'budget_overspent' | 'unusual_charge' | 'spending_shift' | 'categorization_review'; summary: string; action: string; href: string }>;
  annualContext?: Array<{ summary: string; date: string }>;
  seasonalContext?: string[];
  upcoming: Array<{ id: string; date: string; title: string; detail: string; href: string }>;
}

interface AdvisorInsight {
  id: string;
  summary: string;
  action: string;
  actionHref: string;
  sourceCapabilities: string[];
}

interface RecommendationStatus {
  id: string;
  status: 'ACTIVE' | 'DISMISSED' | 'COMPLETED' | 'RESOLVED';
}

interface PeriodicBrief {
  periodDays: 7 | 30;
  readiness: { score: number | null; state: 'known' | 'partial' | 'not_evaluated'; coverage: number };
  scoreChange: { delta: number | null; comparedTo: string | null; elapsedDays: number | null };
  actionsCompleted: number;
  completedRecommendations: Array<{ summary: string; action: string; completedAt: string }>;
  observedRisks: string[];
  newRisks: string[];
  upcoming: Array<{ id: string; date: string; title: string; detail: string; href: string }>;
}

function readinessLabel(brief: MorningBrief) {
  if (brief.readiness.state === 'not_evaluated') return 'NOT ENOUGH INFORMATION YET';
  if (brief.readiness.state === 'partial') return 'PARTIAL PICTURE';
  return 'YOUR HOUSEHOLD PICTURE';
}

function coverageSummary(brief: MorningBrief) {
  if (brief.readiness.state === 'not_evaluated') {
    return 'Add a few more household details so Wardkeep can give you a useful picture.';
  }
  return `Wardkeep has ${brief.readiness.coverage}% of the information it checks.`;
}

export default function BriefPage() {
  const [reviewPeriod, setReviewPeriod] = useState<7 | 30>(7);
  const [handledRecommendationId, setHandledRecommendationId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const brief = useQuery({
    queryKey: ['advisor', 'morning-brief'],
    queryFn: () => apiClient.get<MorningBrief>('/advisor/brief/daily'),
  });
  const insights = useQuery({
    queryKey: ['advisor', 'insights'],
    queryFn: () => apiClient.get<AdvisorInsight[]>('/advisor/insights'),
  });
  const recommendationStatuses = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiClient.get<RecommendationStatus[]>('/recommendations'),
    enabled: Boolean(brief.data?.priority?.id),
  });
  const periodicBrief = useQuery({
    queryKey: ['advisor', 'periodic-brief', reviewPeriod],
    queryFn: () =>
      apiClient.get<PeriodicBrief>(
        `/advisor/brief/${reviewPeriod === 7 ? 'weekly' : 'monthly'}`,
      ),
  });
  const updateRecommendation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'COMPLETED' | 'DISMISSED' }) =>
      apiClient.patch(`/recommendations/${id}`, { status }),
    onSuccess: (_result, variables) => {
      setHandledRecommendationId(variables.id);
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  if (brief.isLoading) {
    return <div className="card"><div className="skeleton h-48 w-full" /></div>;
  }
  if (brief.isError || !brief.data) {
    return <div className="card py-12 text-center text-sm text-content-secondary">Your morning brief is unavailable right now.</div>;
  }

  const data = brief.data;
  const observations = data.observations ?? [];
  const annualContext = data.annualContext ?? [];
  const seasonalContext = data.seasonalContext ?? [];
  const priorityStatus = data.priority?.id
    ? recommendationStatuses.data?.find((recommendation) => recommendation.id === data.priority?.id)?.status
    : undefined;
  const canUpdatePriority = data.priority?.id && priorityStatus !== undefined && priorityStatus === 'ACTIVE';
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-accent-yellow"><Sun size={20} /><span className="text-sm font-medium">MORNING BRIEF</span></div>
        <h1 className="mt-2 text-page-title">{data.greeting}</h1>
        <p className="mt-1 text-sm text-content-secondary">A simple look at the household details you have entered and what is coming up this week.</p>
      </div>

      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="card-title">{readinessLabel(data)}</p>
          <p className="mt-1 text-sm text-content-secondary">{coverageSummary(data)}</p>
        </div>
        <p className="text-4xl font-bold text-content-primary">
          {data.readiness.score === null ? '—' : `${data.readiness.score}%`}
        </p>
      </section>

      <section className="card">
        <div className="flex items-start gap-3">
          <Lightbulb size={20} className="mt-0.5 text-accent-blue" />
          <div className="min-w-0">
            <h2 className="card-title">TODAY’S PRIORITY</h2>
            {data.priority ? (
              <>
                <p className="mt-2 text-sm text-content-primary">{data.priority.summary}</p>
                <Link href={data.priority.href} className="btn-secondary mt-3 text-xs">{data.priority.action}</Link>
                {canUpdatePriority && handledRecommendationId !== data.priority.id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateRecommendation.mutate({ id: data.priority!.id!, status: 'COMPLETED' })}
                      disabled={updateRecommendation.isPending}
                      className="btn-ghost text-xs"
                    ><Check size={14} /> Complete</button>
                    <button
                      onClick={() => updateRecommendation.mutate({ id: data.priority!.id!, status: 'DISMISSED' })}
                      disabled={updateRecommendation.isPending}
                      className="btn-ghost text-xs"
                    ><X size={14} /> Dismiss</button>
                  </div>
                )}
                {canUpdatePriority && handledRecommendationId === data.priority.id && (
                  <p className="mt-3 text-xs text-content-secondary">Recommendation status updated.</p>
                )}
                {priorityStatus && priorityStatus !== 'ACTIVE' && (
                  <p className="mt-3 text-xs text-content-secondary">
                    This recommendation is {priorityStatus.toLowerCase()}.
                  </p>
                )}
              </>
            ) : <p className="mt-2 text-sm text-content-secondary">Nothing stands out from the information Wardkeep has right now.</p>}
          </div>
        </div>
      </section>

      {data.currentRisk && (
        <section className="card border-[var(--accent-yellow)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 text-accent-yellow" />
            <div><h2 className="card-title">CURRENT RISK</h2><p className="mt-2 text-sm text-content-secondary">{data.currentRisk}</p></div>
          </div>
        </section>
      )}

      {observations.length > 0 && (
        <section className="card">
          <div className="flex items-start gap-3">
            <WalletCards size={20} className="mt-0.5 text-accent-yellow" />
            <div className="min-w-0 flex-1">
              <h2 className="card-title">RECORDED SPENDING STATUS</h2>
              <p className="mt-1 text-sm text-content-secondary">Month-to-date budget usage and recent merchant comparisons from recorded transactions.</p>
              <ul className="mt-4 space-y-4">
                {observations.map((observation) => (
                  <li key={observation.summary} className="border-t border-edge pt-4 first:border-t-0 first:pt-0">
                    <p className="text-sm text-content-primary">{observation.summary}</p>
                    <Link href={observation.href} className="btn-secondary mt-3 text-xs">{observation.action}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="card-title">REVIEW</h2>
            <p className="mt-1 text-sm text-content-secondary">
              Recorded changes and completed actions for the selected period.
            </p>
          </div>
          <div className="flex gap-2">
            {([7, 30] as const).map((period) => (
              <button
                key={period}
                className={reviewPeriod === period ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                onClick={() => setReviewPeriod(period)}
              >
                {period === 7 ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
        {periodicBrief.isLoading ? (
          <div className="skeleton mt-4 h-20 w-full" />
        ) : periodicBrief.isError || !periodicBrief.data ? (
          <p className="mt-4 text-sm text-content-secondary">This review is unavailable right now.</p>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-content-primary">
              {periodicBrief.data.scoreChange.delta === null
                ? 'There is no earlier check-in to compare with yet.'
                : `Your household picture ${periodicBrief.data.scoreChange.delta >= 0 ? 'improved' : 'dropped'} by ${Math.abs(periodicBrief.data.scoreChange.delta)} points over ${periodicBrief.data.scoreChange.elapsedDays} days.`}
            </p>
            <p className="text-content-secondary">
              {periodicBrief.data.actionsCompleted === 0
                ? 'No recommendations were marked complete in this period.'
                : `${periodicBrief.data.actionsCompleted} recommendation${periodicBrief.data.actionsCompleted === 1 ? '' : 's'} marked complete.`}
            </p>
            {periodicBrief.data.completedRecommendations.length > 0 && (
              <ul className="space-y-1 text-content-secondary">
                {periodicBrief.data.completedRecommendations.map((recommendation) => (
                  <li key={`${recommendation.summary}-${recommendation.completedAt}`}>
                    {recommendation.summary}
                  </li>
                ))}
              </ul>
            )}
            {periodicBrief.data.newRisks.length > 0 && (
              <div>
                <p className="font-medium text-content-primary">New things that need attention</p>
                <ul className="mt-1 space-y-1 text-content-secondary">
                  {periodicBrief.data.newRisks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {!insights.isError && (insights.data?.length ?? 0) > 0 && (
        <section className="card">
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="mt-0.5 text-accent-purple" />
            <div className="min-w-0 flex-1">
              <h2 className="card-title">CONNECTED INSIGHTS</h2>
              <p className="mt-1 text-sm text-content-secondary">
                Helpful connections Wardkeep found across more than one part of your household information.
              </p>
              <ul className="mt-4 space-y-4">
                {insights.data!.map((insight) => (
                  <li key={insight.id} className="border-t border-edge pt-4 first:border-t-0 first:pt-0">
                    <p className="text-sm text-content-primary">{insight.summary}</p>
                    <p className="mt-1 text-xs text-content-tertiary">
                      Based on: {insight.sourceCapabilities.join(' · ')}
                    </p>
                    <Link href={insight.actionHref} className="btn-secondary mt-3 text-xs">
                      {insight.action}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {annualContext.length > 0 && (
        <section className="card">
          <div className="flex items-start gap-3">
            <CalendarDays size={20} className="mt-0.5 text-accent-blue" />
            <div className="min-w-0 flex-1">
              <h2 className="card-title">ANNUAL CONTEXT</h2>
              <p className="mt-1 text-sm text-content-secondary">Your locally recorded annual reminders. Wardkeep does not predict an expense or outcome from these entries.</p>
              <ul className="mt-4 space-y-3">
                {annualContext.map((memory) => (
                  <li key={`${memory.summary}-${memory.date}`} className="border-t border-edge pt-3 first:border-t-0 first:pt-0">
                    <p className="text-sm text-content-primary">{memory.summary}</p>
                    <p className="mt-1 text-xs text-content-secondary">{new Date(memory.date).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
              <Link href="/advisor-memory" className="btn-secondary mt-4 text-xs">Review local memory</Link>
            </div>
          </div>
        </section>
      )}

      {seasonalContext.length > 0 && (
        <section className="card">
          <div className="flex items-start gap-3">
            <CalendarDays size={20} className="mt-0.5 text-accent-purple" />
            <div className="min-w-0 flex-1">
              <h2 className="card-title">RECORDED SEASONAL CONTEXT</h2>
              <p className="mt-1 text-sm text-content-secondary">Prior-year records for this calendar month. These are not a prediction or a spending target.</p>
              <ul className="mt-4 space-y-2 text-sm text-content-primary">
                {seasonalContext.map((summary) => <li key={summary}>{summary}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="flex items-center gap-2"><CalendarDays size={20} className="text-accent-purple" /><h2 className="card-title">COMING UP THIS WEEK</h2></div>
        {data.upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-content-secondary">No recorded events are coming up in the next seven days.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.upcoming.map((event) => (
              <li key={event.id} className="border-t border-edge pt-3 first:border-t-0 first:pt-0">
                <Link href={event.href} className="text-sm font-medium text-content-primary hover:text-accent-blue">{event.title}</Link>
                <p className="mt-1 text-xs text-content-secondary">{new Date(event.date).toLocaleDateString()} · {event.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
