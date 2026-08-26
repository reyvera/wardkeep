'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Lightbulb, Sun } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface MorningBrief {
  greeting: string;
  readiness: { score: number | null; state: 'known' | 'partial' | 'not_evaluated'; coverage: number };
  priority: { summary: string; action: string; href: string } | null;
  currentRisk: string | null;
  upcoming: Array<{ id: string; date: string; title: string; detail: string; href: string }>;
}

interface AdvisorInsight {
  id: string;
  summary: string;
  action: string;
  actionHref: string;
  sourceCapabilities: string[];
}

function readinessLabel(brief: MorningBrief) {
  if (brief.readiness.state === 'not_evaluated') return 'Not evaluated yet';
  if (brief.readiness.state === 'partial') return 'Partial picture';
  return 'Readiness';
}

function coverageSummary(brief: MorningBrief) {
  if (brief.readiness.state === 'not_evaluated') {
    return 'Wardkeep has not evaluated readiness factors from the available records yet.';
  }
  return `${brief.readiness.coverage}% of currently evaluated factors are covered.`;
}

export default function BriefPage() {
  const brief = useQuery({
    queryKey: ['advisor', 'morning-brief'],
    queryFn: () => apiClient.get<MorningBrief>('/advisor/brief/morning'),
  });
  const insights = useQuery({
    queryKey: ['advisor', 'insights'],
    queryFn: () => apiClient.get<AdvisorInsight[]>('/advisor/insights'),
  });

  if (brief.isLoading) {
    return <div className="card"><div className="skeleton h-48 w-full" /></div>;
  }
  if (brief.isError || !brief.data) {
    return <div className="card py-12 text-center text-sm text-content-secondary">Your morning brief is unavailable right now.</div>;
  }

  const data = brief.data;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-accent-yellow"><Sun size={20} /><span className="text-sm font-medium">MORNING BRIEF</span></div>
        <h1 className="mt-2 text-page-title">{data.greeting}</h1>
        <p className="mt-1 text-sm text-content-secondary">A deterministic view of your recorded household information for the week ahead.</p>
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
              </>
            ) : <p className="mt-2 text-sm text-content-secondary">No active recommendation is currently supported by the available records.</p>}
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

      {!insights.isError && (insights.data?.length ?? 0) > 0 && (
        <section className="card">
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="mt-0.5 text-accent-purple" />
            <div className="min-w-0 flex-1">
              <h2 className="card-title">CONNECTED INSIGHTS</h2>
              <p className="mt-1 text-sm text-content-secondary">
                Observations supported by more than one recorded readiness factor.
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
