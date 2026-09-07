'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, FlaskConical, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type DirectPillar = 'protection' | 'provision' | 'prosperity';
type SignalType = 'risk' | 'opportunity' | 'milestone' | 'warning' | 'positive';

interface Signal {
  capabilityId: string;
  type: SignalType;
  magnitude: number;
  pillar: DirectPillar | 'peace';
  summary: string;
  weight?: number;
}

interface Assessment {
  overallAssessment: { score: number | null; coverage: number };
  pillars: Record<DirectPillar | 'peace', number>;
  pillarAssessments: Record<string, { score: number | null; coverage: number }>;
  coverage: number;
}

interface ReadinessResponse {
  signals: Signal[];
}

interface ScenarioResponse {
  current: Assessment;
  scenario: Assessment;
  limitations: string[];
}

interface CashReserveScenarioResponse extends ScenarioResponse {
  builder: {
    proposedReserves: string;
    sourceRecords: string[];
    assumptions: string[];
  };
}

function score(value: number | null) {
  return value === null ? '—' : `${value}%`;
}

function pillarLabel(pillar: DirectPillar | 'peace') {
  return pillar[0].toUpperCase() + pillar.slice(1);
}

function factorEffect(magnitude: number) {
  if (magnitude >= 4) return 'Strongly favorable';
  if (magnitude > 0) return 'Favorable';
  if (magnitude === 0) return 'No effect';
  if (magnitude <= -4) return 'Strongly unfavorable';
  return 'Unfavorable';
}

export default function ReadinessScenariosPage() {
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);
  const [magnitude, setMagnitude] = useState(0);
  const [proposedReserves, setProposedReserves] = useState('');
  const [cashReserveScenario, setCashReserveScenario] = useState<CashReserveScenarioResponse | null>(
    null,
  );
  const readinessQuery = useQuery({
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessResponse>('/readiness'),
  });
  const factors = useMemo(
    () => (readinessQuery.data?.signals ?? []).filter((signal) => signal.pillar !== 'peace'),
    [readinessQuery.data],
  );
  const selectedFactor =
    factors.find((factor) => factor.capabilityId === selectedCapabilityId) ?? factors[0];
  const scenarioMutation = useMutation({
    mutationFn: (body: unknown) => apiClient.post<ScenarioResponse>('/readiness/scenario', body),
  });
  const cashReserveMutation = useMutation({
    mutationFn: (value: string) =>
      apiClient.post<CashReserveScenarioResponse>('/readiness/scenario/cash-reserves', {
        proposedReserves: value,
      }),
    onSuccess: setCashReserveScenario,
  });
  const comparison = cashReserveScenario ?? scenarioMutation.data;

  const selectFactor = (capabilityId: string) => {
    const factor = factors.find((candidate) => candidate.capabilityId === capabilityId);
    setSelectedCapabilityId(capabilityId);
    setMagnitude(factor?.magnitude ?? 0);
    scenarioMutation.reset();
    setCashReserveScenario(null);
  };

  const compareWithMagnitude = () => {
    if (!selectedFactor) return;
    setCashReserveScenario(null);
    scenarioMutation.mutate({
      changes: [
        {
          operation: 'replace',
          capabilityId: selectedFactor.capabilityId,
          signal: { ...selectedFactor, magnitude },
        },
      ],
    });
  };

  const compareWithoutFactor = () => {
    if (!selectedFactor) return;
    setCashReserveScenario(null);
    scenarioMutation.mutate({
      changes: [{ operation: 'remove', capabilityId: selectedFactor.capabilityId }],
    });
  };

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard" className="btn-ghost mb-5 w-fit text-xs">
        <ArrowLeft size={14} /> Dashboard
      </Link>
      <div className="flex flex-col gap-4 border-b border-edge pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="card-title text-accent-blue">Readiness comparison</p>
          <h1 className="text-page-title mt-1">Explore a recorded factor</h1>
          <p className="mt-2 max-w-2xl text-sm text-content-secondary">
            Compare the current household picture with one explicit change to information Wardkeep
            already evaluates. This is a transparent comparison—not a prediction or recommendation.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface-secondary px-3 py-2 text-xs text-content-secondary">
          <FlaskConical size={16} className="text-accent-blue" />
          Never saved
        </div>
      </div>

      {readinessQuery.isLoading && (
        <div className="card mt-6">
          <div className="skeleton h-48 w-full" />
        </div>
      )}
      {readinessQuery.isError && (
        <div className="card mt-6 py-10 text-center text-sm text-content-secondary">
          Wardkeep cannot load readiness factors right now. Return to the dashboard and try again.
        </div>
      )}
      {readinessQuery.isSuccess && factors.length === 0 && (
        <div className="card mt-6 py-10 text-center">
          <p className="font-medium text-content-primary">
            No readiness factors are available yet.
          </p>
          <p className="mt-1 text-sm text-content-secondary">
            Add household records first, then return here to compare a factor Wardkeep can explain.
          </p>
          <Link href="/dashboard" className="btn-secondary mt-4 text-sm">
            Back to dashboard
          </Link>
        </div>
      )}
      {selectedFactor && (
        <>
          <section className="card mt-6">
            <label htmlFor="scenario-factor" className="card-title">
              Recorded factor
            </label>
            <select
              id="scenario-factor"
              className="input mt-2 w-full max-w-2xl"
              value={selectedFactor.capabilityId}
              onChange={(event) => selectFactor(event.target.value)}
            >
              {factors.map((factor) => (
                <option key={factor.capabilityId} value={factor.capabilityId}>
                  {pillarLabel(factor.pillar)} · {factor.summary}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-content-tertiary">
              Current recorded effect: {factorEffect(selectedFactor.magnitude)} (
              {selectedFactor.magnitude})
            </p>

            {selectedFactor.capabilityId === 'emergency-fund' && (
              <div className="mt-5 max-w-2xl rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-4">
                <p className="text-sm font-medium text-content-primary">Compare a cash-reserves amount</p>
                <p className="mt-1 text-xs text-content-secondary">
                  This temporarily replaces the liquid-reserve total and keeps the recorded expense
                  evidence unchanged. It does not edit any account.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    aria-label="Temporary liquid reserves"
                    type="number"
                    min="0"
                    step="0.01"
                    value={proposedReserves}
                    onChange={(event) => setProposedReserves(event.target.value)}
                    placeholder="Liquid reserves, e.g. 12000"
                    className="input min-w-52 flex-1"
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={
                      cashReserveMutation.isPending ||
                      proposedReserves === '' ||
                      Number(proposedReserves) < 0
                    }
                    onClick={() => {
                      scenarioMutation.reset();
                      cashReserveMutation.mutate(proposedReserves);
                    }}
                  >
                    {cashReserveMutation.isPending ? 'Comparing…' : 'Compare reserves'}
                  </button>
                </div>
                {cashReserveMutation.isError && (
                  <p className="mt-2 text-xs text-accent-red">Reserve comparison is unavailable.</p>
                )}
              </div>
            )}

            <div className="mt-6 max-w-2xl">
              <div className="flex items-end justify-between gap-4">
                <label
                  htmlFor="scenario-magnitude"
                  className="text-sm font-medium text-content-primary"
                >
                  Assume this factor becomes
                </label>
                <span className="text-sm font-semibold text-content-primary">
                  {factorEffect(magnitude)}
                </span>
              </div>
              <input
                id="scenario-magnitude"
                className="mt-3 w-full accent-[var(--accent-blue)]"
                type="range"
                min={-10}
                max={10}
                step={1}
                value={magnitude}
                onChange={(event) => {
                  setMagnitude(Number(event.target.value));
                  scenarioMutation.reset();
                }}
              />
              <div className="mt-1 flex justify-between text-xs text-content-tertiary">
                <span>Strongly unfavorable</span>
                <span>No effect</span>
                <span>Strongly favorable</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="btn-primary text-sm"
                onClick={compareWithMagnitude}
                disabled={scenarioMutation.isPending}
              >
                {scenarioMutation.isPending ? 'Comparing…' : 'Compare change'}{' '}
                <ArrowRight size={15} />
              </button>
              <button
                className="btn-secondary text-sm"
                onClick={compareWithoutFactor}
                disabled={scenarioMutation.isPending}
              >
                Compare without factor
              </button>
              {comparison && (
                <button
                  className="btn-ghost text-sm"
                  onClick={() => {
                    scenarioMutation.reset();
                    setCashReserveScenario(null);
                  }}
                >
                  <RotateCcw size={14} /> Clear comparison
                </button>
              )}
            </div>
            {scenarioMutation.isError && (
              <p className="mt-3 text-sm text-accent-red">
                {scenarioMutation.error instanceof Error
                  ? scenarioMutation.error.message
                  : 'Comparison unavailable right now.'}
              </p>
            )}
          </section>

          {comparison && (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
                {(
                  [
                    ['Current recorded picture', comparison.current],
                    ['Comparison', comparison.scenario],
                  ] as const
                ).map(([label, assessment]) => (
                  <article key={label} className="card">
                    <p className="card-title">{label}</p>
                    <p className="mt-2 text-4xl font-bold text-content-primary">
                      {score(assessment.overallAssessment.score)}
                    </p>
                    <p className="mt-1 text-sm text-content-secondary">
                      {assessment.coverage}% of the household picture checked
                    </p>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      {(['protection', 'provision', 'prosperity', 'peace'] as const).map(
                        (pillar) => (
                          <div key={pillar} className="border-t border-edge pt-2">
                            <dt className="text-content-tertiary">{pillarLabel(pillar)}</dt>
                            <dd className="mt-0.5 font-semibold text-content-primary">
                              {score(assessment.pillarAssessments[pillar]?.score)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </article>
                ))}
              </section>
              <section className="card mt-6 border-accent-blue/20 bg-accent-blue/5">
                <p className="card-title text-accent-blue">What this means</p>
                <ul className="mt-2 space-y-1 text-sm text-content-secondary">
                  {comparison.limitations.map((limitation) => (
                    <li key={limitation}>• {limitation}</li>
                  ))}
                </ul>
                {cashReserveScenario && (
                  <p className="mt-3 text-xs text-content-secondary">
                    Sources: {cashReserveScenario.builder.sourceRecords.join(' · ')}
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
