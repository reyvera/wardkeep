'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';

type TimelineEventKind = 'RECURRING_BILL' | 'POLICY_RENEWAL' | 'INCOME' | 'PLANNED_EXPENSE';

interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  date: string;
  title: string;
  detail: string;
  href: string;
}

const eventIcons = {
  RECURRING_BILL: ReceiptText,
  POLICY_RENEWAL: ShieldCheck,
  INCOME: CircleDollarSign,
  PLANNED_EXPENSE: CalendarClock,
};

const eventLabels: Record<TimelineEventKind, string> = {
  RECURRING_BILL: 'Recurring bill',
  POLICY_RENEWAL: 'Policy renewal',
  INCOME: 'Expected income',
  PLANNED_EXPENSE: 'Planned expense',
};

function dayKey(date: string) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

function dayLabel(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function TimelinePage() {
  const [days, setDays] = useState(30);
  const timeline = useQuery({
    queryKey: ['timeline', days],
    queryFn: () => apiClient.get<TimelineEvent[]>(`/timeline/upcoming?days=${days}`),
  });

  const groups = (timeline.data ?? []).reduce<Record<string, TimelineEvent[]>>((result, event) => {
    const key = dayKey(event.date);
    (result[key] ??= []).push(event);
    return result;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-page-title">Timeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-content-secondary">
            Upcoming dates recorded in your household—not forecasts or inferred obligations.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          Show
          <select
            className="input w-28 py-2"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </label>
      </div>

      <div className="card border-accent-blue/20 bg-accent-blue/5">
        <div className="flex gap-3">
          <CalendarDays className="mt-0.5 shrink-0 text-accent-blue" size={20} />
          <p className="text-sm text-content-secondary">
            Includes confirmed recurring bills, policy renewals, expected income dates, and planned
            expenses. Add or change a record in its source workspace.
          </p>
        </div>
      </div>

      {timeline.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="card h-24 skeleton" />
          ))}
        </div>
      ) : timeline.isError ? (
        <div className="card">
          <p className="text-sm text-accent-red">
            Timeline is unavailable right now. Please try again.
          </p>
        </div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="card py-12 text-center">
          <CalendarDays className="mx-auto text-content-tertiary" size={28} />
          <p className="mt-3 font-medium text-content-primary">
            No recorded dates in the next {days} days.
          </p>
          <p className="mt-1 text-sm text-content-secondary">
            Add a recurring bill, policy renewal, expected income date, or planned expense when you
            know it.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, events]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-semibold text-content-secondary">
                {dayLabel(events[0]!.date)}
              </h2>
              <div className="space-y-2">
                {events.map((event) => {
                  const Icon = eventIcons[event.kind];
                  return (
                    <Link
                      key={event.id}
                      href={event.href}
                      className="card flex items-center gap-4 transition-colors hover:border-accent-blue/40"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-tertiary">
                        <Icon size={18} className="text-accent-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-content-primary">{event.title}</p>
                        <p className="mt-0.5 text-sm text-content-secondary">{event.detail}</p>
                      </div>
                      <span className="hidden text-xs text-content-tertiary sm:inline">
                        {eventLabels[event.kind]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
