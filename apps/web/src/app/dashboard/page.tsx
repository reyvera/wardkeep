'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Shield, TrendingUp, Wallet, PiggyBank, Hammer,
  AlertTriangle, Lightbulb, Activity, BarChart3,
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
  coverage: number;
  pillarCoverage: Record<'protection' | 'provision' | 'preparation' | 'prosperity', number>;
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
    case 'risk': return AlertTriangle;
    case 'warning': return AlertTriangle;
    case 'opportunity': return Lightbulb;
    case 'positive': return TrendingUp;
    case 'milestone': return Activity;
  }
}

function getSignalColor(type: Signal['type']): string {
  switch (type) {
    case 'risk': return 'var(--accent-red)';
    case 'warning': return 'var(--accent-amber)';
    case 'opportunity': return 'var(--accent-blue)';
    case 'positive': return 'var(--accent-green)';
    case 'milestone': return 'var(--accent-green)';
  }
}

function coverageLabel(coverage: number): string {
  if (coverage >= 75) return 'High confidence';
  if (coverage >= 40) return 'Moderate confidence';
  if (coverage > 0) return 'Limited confidence';
  return 'Not evaluated';
}

const PILLAR_META: Record<string, { label: string; icon: typeof Shield; description: string }> = {
  protection: {
    label: 'Protection',
    icon: Shield,
    description: 'Emergency fund, insurance, security',
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const readinessQuery = useQuery({
    queryKey: ['readiness'],
    queryFn: () => apiClient.get<ReadinessResponse>('/readiness'),
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
          <div className="card"><div className="skeleton h-32 w-full" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card"><div className="skeleton h-20 w-full" /></div>
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
  const scoreColor = getScoreColor(data.overall);
  const scoreLabel = getScoreLabel(data.overall);
  const scoredPillars = Object.entries(data.pillars).filter(([key, score]) => key === 'peace' || score > 0);
  const strongest = scoredPillars.sort((a, b) => b[1] - a[1])[0];
  const weakest = scoredPillars.sort((a, b) => a[1] - b[1])[0];
  const history = data.history.slice(-90);
  const trendDelta = history.length > 1 ? data.overall - history[0]!.overall : 0;
  const recommend = [...data.topRisks, ...data.topOpportunities].slice(0, 3);

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
                cx="50" cy="50" r="42"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="8"
              />
              {data.coverage > 0 && <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${data.overall * 2.64} 264`} />}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-content-primary">{data.coverage ? `${data.overall}%` : '—'}</span>
              <span className="text-xs font-medium" style={{ color: scoreColor }}>{data.coverage ? scoreLabel : 'Unknown'}</span>
            </div>
          </div>

          {/* Summary text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-semibold text-content-primary mb-1">Household readiness</h2>
            <p className="text-sm text-content-secondary">
              {data.coverage === 0
                ? 'Add accounts and ordinary expenses before Wardkeep can assess your readiness.'
                : <>{strongest && <>Strongest: <span className="text-content-primary">{PILLAR_META[strongest[0]]?.label} {strongest[1]}</span>. </>}{weakest && <>Most limited: <span className="text-content-primary">{PILLAR_META[weakest[0]]?.label} {weakest[1]}</span>. </>}Scores reflect the information currently available.</>}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-content-tertiary">
              <span>{coverageLabel(data.coverage)} · {data.coverage}% coverage</span>
              {history.length > 1 && <span className={trendDelta >= 0 ? 'text-accent-green' : 'text-accent-red'}>{trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta)} over 90 days</span>}
            </div>
            {history.length > 1 && (
              <svg viewBox="0 0 180 36" className="w-full max-w-xs h-9 mt-3" aria-label="Readiness trend">
                <polyline fill="none" stroke={scoreColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={history.map((point, index) => `${(index / (history.length - 1)) * 180},${34 - point.overall * 0.32}`).join(' ')} />
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

          const coverage = key === 'peace' ? data.coverage : data.pillarCoverage[key as keyof ReadinessResponse['pillarCoverage']] ?? 0;
          const pillarSignals = data.signals.filter((signal) => signal.pillar === key).slice(0, 2);
          return (
            <Link href="/dashboard/details" key={key} className="card block transition-colors hover:border-[var(--accent-blue)]">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color }} />
                <span className="text-sm font-medium text-content-primary">{meta.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold" style={{ color }}>{coverage ? `${score}%` : '—'}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${coverage ? score : 0}%`, backgroundColor: color }}
                />
              </div>
              <p className="text-xs text-content-tertiary mt-2">{key === 'peace' ? 'Derived from your least-ready area' : `${coverageLabel(coverage)} · ${coverage}% covered`}</p>
              {pillarSignals.map((signal) => <p key={signal.capabilityId} className="text-xs text-content-secondary mt-1 line-clamp-2">{signal.summary}</p>)}
            </Link>
          );
        })}
      </div>

      {/* Action-oriented next steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-title">Needs attention</h3>
          {data.topRisks.length === 0 ? (
            <p className="text-sm text-content-tertiary">No confirmed risks yet. More household information improves this assessment.</p>
          ) : (
            <ul className="space-y-3">
              {data.topRisks.map((signal, i) => {
                const Icon = getSignalIcon(signal.type);
                const color = getSignalColor(signal.type);
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon size={16} className="mt-0.5 flex-shrink-0" style={{ color }} />
                    <span className="text-sm text-content-primary">{signal.summary}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Wardkeep recommends</h3>
          {recommend.length === 0 ? (
            <p className="text-sm text-content-tertiary">Add accounts, expenses, and a budget to receive tailored next steps.</p>
          ) : (
            <ul className="space-y-3">
              {recommend.map((signal, i) => {
                const Icon = getSignalIcon(signal.type);
                const color = getSignalColor(signal.type);
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon size={16} className="mt-0.5 flex-shrink-0" style={{ color }} />
                    <div><span className="text-sm text-content-primary">{signal.summary}</span><p className="text-xs text-content-tertiary mt-0.5">{PILLAR_META[signal.pillar]?.label ?? 'Readiness'} · based on available data</p></div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
