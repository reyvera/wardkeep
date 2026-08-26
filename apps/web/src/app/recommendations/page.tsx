'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, CircleOff, Lightbulb, X } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface Recommendation {
  id: string;
  signalSummary: string;
  action: string;
  actionHref: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assumptions: string;
  impactPreview: string;
  projectedPillarDelta: number | null;
  estimatedAmount: string | null;
  estimatedMonthlyAmount: string | null;
  estimatedAmountLabel: string | null;
  estimatedCompletionDays: number | null;
  status: 'ACTIVE' | 'DISMISSED' | 'COMPLETED' | 'RESOLVED';
  updatedAt: string;
}

interface ReadinessRefresh {
  evaluatedAt: string;
}

function priorityClass(priority: Recommendation['priority']) {
  if (priority === 'critical') return 'text-accent-red';
  if (priority === 'high') return 'text-accent-orange';
  if (priority === 'medium') return 'text-accent-yellow';
  return 'text-accent-blue';
}

function statusLabel(status: Recommendation['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function RecommendationsPage() {
  const queryClient = useQueryClient();
  const readinessQuery = useQuery({
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessRefresh>('/readiness'),
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiClient.get<Recommendation[]>('/recommendations'),
    enabled: readinessQuery.isSuccess,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'COMPLETED' | 'DISMISSED' }) =>
      apiClient.patch(`/recommendations/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const recommendations = recommendationsQuery.data ?? [];
  const active = recommendations.filter((recommendation) => recommendation.status === 'ACTIVE');
  const history = recommendations.filter((recommendation) => recommendation.status !== 'ACTIVE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Recommendations</h1>
        <p className="mt-1 text-sm text-content-secondary">
          The next useful actions Wardkeep can support from the household information available.
        </p>
      </div>

      {(readinessQuery.isLoading || recommendationsQuery.isLoading) && (
        <div className="card">
          <div className="skeleton h-32 w-full" />
        </div>
      )}
      {(readinessQuery.isError || recommendationsQuery.isError) && (
        <div className="card text-center py-12">
          <p className="text-sm text-content-secondary">
            Recommendations are unavailable right now.
          </p>
        </div>
      )}

      {!readinessQuery.isLoading &&
        !recommendationsQuery.isLoading &&
        !readinessQuery.isError &&
        !recommendationsQuery.isError && (
          <>
            <section className="card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="card-title">ACTIVE ACTIONS</h2>
                  <p className="text-sm text-content-secondary">
                    {active.length} currently need attention.
                  </p>
                </div>
                <Lightbulb size={22} className="text-accent-blue" />
              </div>

              {active.length === 0 ? (
                <p className="mt-5 text-sm text-content-tertiary">
                  No active recommendations. As readiness signals change, useful actions will appear
                  here.
                </p>
              ) : (
                <ul className="mt-5 space-y-4">
                  {active.map((recommendation) => (
                    <li
                      key={recommendation.id}
                      className="border-t border-edge pt-4 first:border-t-0 first:pt-0"
                    >
                      <div className="flex gap-3">
                        <Lightbulb
                          size={17}
                          className={`mt-0.5 flex-shrink-0 ${priorityClass(recommendation.priority)}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-medium text-content-primary">
                              {recommendation.signalSummary}
                            </p>
                            <span
                              className={`text-xs font-medium capitalize ${priorityClass(recommendation.priority)}`}
                            >
                              {recommendation.priority} priority
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-content-tertiary">
                            Assumption: {recommendation.assumptions}
                          </p>
                          <p className="mt-1 text-xs text-content-secondary">
                            Impact preview: {recommendation.impactPreview}
                          </p>
                          {(recommendation.estimatedAmount || recommendation.estimatedMonthlyAmount) && (
                            <p className="mt-1 text-xs text-content-secondary">
                              {recommendation.estimatedAmountLabel ?? 'Recorded financial impact'}:{' '}
                              {recommendation.estimatedAmount
                                ? `$${recommendation.estimatedAmount}`
                                : `$${recommendation.estimatedMonthlyAmount} per month`}
                              {recommendation.estimatedAmount && recommendation.estimatedMonthlyAmount
                                ? ` · $${recommendation.estimatedMonthlyAmount} per month recorded`
                                : ''}
                              {recommendation.estimatedCompletionDays !== null
                                ? ` · due in ${recommendation.estimatedCompletionDays} days`
                                : ' · timing is not estimated'}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Link
                              href={recommendation.actionHref}
                              className="btn-secondary text-xs"
                            >
                              {recommendation.action}
                            </Link>
                            <button
                              onClick={() =>
                                updateMutation.mutate({
                                  id: recommendation.id,
                                  status: 'COMPLETED',
                                })
                              }
                              className="btn-ghost text-xs"
                            >
                              <Check size={14} /> Complete
                            </button>
                            <button
                              onClick={() =>
                                updateMutation.mutate({
                                  id: recommendation.id,
                                  status: 'DISMISSED',
                                })
                              }
                              className="btn-ghost text-xs"
                            >
                              <X size={14} /> Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {history.length > 0 && (
              <section className="card">
                <h2 className="card-title">ACTION HISTORY</h2>
                <ul className="mt-4 space-y-3">
                  {history.map((recommendation) => (
                    <li key={recommendation.id} className="flex items-start gap-3 text-sm">
                      {recommendation.status === 'COMPLETED' ? (
                        <CheckCircle2 size={16} className="mt-0.5 text-accent-green" />
                      ) : (
                        <CircleOff size={16} className="mt-0.5 text-content-tertiary" />
                      )}
                      <div>
                        <p className="text-content-primary">{recommendation.signalSummary}</p>
                        <p className="mt-0.5 text-xs text-content-tertiary">
                          {statusLabel(recommendation.status)} · updated{' '}
                          {new Date(recommendation.updatedAt).toLocaleDateString()}
                        </p>
                        {(recommendation.status === 'COMPLETED' ||
                          recommendation.status === 'DISMISSED') && (
                          <button
                            onClick={() =>
                              updateMutation.mutate({ id: recommendation.id, status: 'ACTIVE' })
                            }
                            className="btn-ghost mt-2 text-xs"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
    </div>
  );
}
