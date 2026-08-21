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

  return (
    <div>
      {/* Header with link to detailed analytics */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-page-title">Dashboard</h1>
        <Link href="/dashboard/details" className="btn-ghost text-xs">
          <BarChart3 size={14} />
          Spending Details
        </Link>
      </div>

      {/* Overall Score */}
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
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${data.overall * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-content-primary">{data.overall}%</span>
              <span className="text-xs font-medium" style={{ color: scoreColor }}>{scoreLabel}</span>
            </div>
          </div>

          {/* Summary text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-semibold text-content-primary mb-1">
              {data.overall >= 80
                ? 'You are in good shape.'
                : data.overall >= 60
                  ? 'Some areas need attention.'
                  : 'Action needed to improve readiness.'}
            </h2>
            <p className="text-sm text-content-secondary">
              Your readiness score reflects your household&apos;s financial preparedness across
              {' '}{Object.keys(data.pillars).length} dimensions.
            </p>
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

          return (
            <div key={key} className="card">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color }} />
                <span className="text-sm font-medium text-content-primary">{meta.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold" style={{ color }}>{score}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
              <p className="text-xs text-content-tertiary mt-2">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* Risks and Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Risks */}
        <div className="card">
          <h3 className="card-title">Top Risks</h3>
          {data.topRisks.length === 0 ? (
            <p className="text-sm text-content-tertiary">No active risks detected.</p>
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

        {/* Top Opportunities */}
        <div className="card">
          <h3 className="card-title">Strengths & Opportunities</h3>
          {data.topOpportunities.length === 0 ? (
            <p className="text-sm text-content-tertiary">Add accounts and transactions to discover opportunities.</p>
          ) : (
            <ul className="space-y-3">
              {data.topOpportunities.map((signal, i) => {
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
      </div>
    </div>
  );
}
