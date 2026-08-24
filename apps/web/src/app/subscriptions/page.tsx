'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, CalendarClock } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface RecurringTransaction {
  id: string;
  merchant: string;
  expectedAmount: string;
  frequency: string;
  nextExpected: string;
  isSubscription: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthlyEquivalent(record: RecurringTransaction): number {
  const amount = Number(record.expectedAmount);
  const multipliers: Record<string, number> = {
    WEEKLY: 52 / 12,
    BIWEEKLY: 26 / 12,
    MONTHLY: 1,
    QUARTERLY: 1 / 3,
    SEMIANNUAL: 1 / 6,
    ANNUAL: 1 / 12,
  };
  return amount * (multipliers[record.frequency] ?? 1);
}

export default function SubscriptionsPage() {
  const subscriptionsQuery = useQuery({
    queryKey: ['recurring', 'subscriptions'],
    queryFn: () => apiClient.get<RecurringTransaction[]>('/recurring'),
  });
  const subscriptions = (subscriptionsQuery.data ?? []).filter((record) => record.isSubscription);
  const monthlyTotal = subscriptions.reduce((sum, record) => sum + monthlyEquivalent(record), 0);
  const annual = subscriptions.filter((record) => record.frequency === 'ANNUAL');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title text-content-primary">Subscriptions</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Services you have explicitly marked as subscriptions.
          </p>
        </div>
        <Link href="/recurring" className="btn-secondary">
          Manage recurring bills
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <span className="card-title">MONTHLY EQUIVALENT</span>
          <p className="mt-1 text-2xl font-bold tabular-nums text-content-primary">
            ${formatCurrency(monthlyTotal)}
          </p>
          <p className="mt-1 text-xs text-content-tertiary">
            Normalizes annual and less-frequent bills.
          </p>
        </div>
        <div className="card">
          <span className="card-title">ACTIVE SUBSCRIPTIONS</span>
          <p className="mt-1 text-2xl font-bold tabular-nums text-content-primary">
            {subscriptions.length}
          </p>
          <p className="mt-1 text-xs text-content-tertiary">
            {annual.length} annual {annual.length === 1 ? 'renewal' : 'renewals'} tracked
          </p>
        </div>
      </div>

      {subscriptionsQuery.isLoading && (
        <div className="card text-sm text-content-tertiary">Loading subscriptions…</div>
      )}

      {!subscriptionsQuery.isLoading && subscriptions.length === 0 && (
        <div className="card py-12 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-content-tertiary" />
          <p className="text-sm text-content-secondary">No subscriptions marked yet</p>
          <p className="mt-1 text-xs text-content-tertiary">
            Open Cash Flow and use the card icon beside a recurring bill to mark it as a
            subscription.
          </p>
        </div>
      )}

      {subscriptions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-section text-content-primary">Active services</h2>
          {subscriptions.map((record) => (
            <div key={record.id} className="card flex items-center gap-4 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple/10">
                <CreditCard size={14} className="text-accent-purple" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content-primary">{record.merchant}</p>
                <p className="text-xs text-content-tertiary">
                  {record.frequency} · next charge{' '}
                  {new Date(record.nextExpected).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums text-content-primary">
                ${formatCurrency(Number(record.expectedAmount))}
              </p>
              {record.frequency === 'ANNUAL' && (
                <CalendarClock
                  size={15}
                  className="text-accent-yellow"
                  aria-label="Annual renewal"
                />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
