'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { RefreshCw, Check, X, CalendarClock, PauseCircle } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: string;
}
interface RecurringTransaction {
  id: string;
  merchant: string;
  expectedAmount: string;
  frequency: string;
  nextExpected: string;
  isConfirmed: boolean;
}
interface CashFlowProjection {
  date: string;
  balance: string;
  credits: string;
  debits: string;
}
interface CashFlowResult {
  projections: CashFlowProjection[];
  belowZeroNotifications: {
    accountId: string;
    accountName: string;
    date: string;
    projectedAmount: string;
  }[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  // Auto-select the first account once accounts load
  useEffect(() => {
    if (accountsQuery.data && accountsQuery.data.length > 0 && !accountId) {
      setAccountId(accountsQuery.data[0].id);
    }
  }, [accountsQuery.data, accountId]);

  const recurringQuery = useQuery({
    queryKey: ['recurring'],
    queryFn: () => apiClient.get<RecurringTransaction[]>('/recurring'),
  });
  const detectedQuery = useQuery({
    queryKey: ['recurring', 'detected'],
    queryFn: () => apiClient.get<RecurringTransaction[]>('/recurring/detected'),
  });
  const cashFlowQuery = useQuery({
    queryKey: ['cashflow', accountId],
    queryFn: () => apiClient.get<CashFlowResult>(`/cashflow/forecast?accountId=${accountId}`),
    enabled: !!accountId,
  });

  const refreshRecurring = () => queryClient.invalidateQueries({ queryKey: ['recurring'] });
  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiClient.post('/recurring/confirm', { id }),
    onSuccess: refreshRecurring,
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post('/recurring/dismiss', { id }),
    onSuccess: refreshRecurring,
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post('/recurring/deactivate', { id }),
    onSuccess: refreshRecurring,
  });

  const confirmed = recurringQuery.data ?? [];
  const detected = detectedQuery.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Cash Flow &amp; Recurring</h1>

      {cashFlowQuery.data &&
        cashFlowQuery.data.projections.length > 0 &&
        (() => {
          const projections = cashFlowQuery.data.projections;
          const endBalance = Number(projections[projections.length - 1].balance);
          const lowest = projections.reduce(
            (min, p) => (Number(p.balance) < Number(min.balance) ? p : min),
            projections[0],
          );
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <span className="card-title">END BALANCE (90D)</span>
                <p className="text-2xl font-bold tabular-nums text-content-primary">
                  ${formatCurrency(endBalance)}
                </p>
              </div>
              <div className="card">
                <span className="card-title">LOWEST BALANCE</span>
                <p className="text-2xl font-bold tabular-nums text-accent-red">
                  ${formatCurrency(Number(lowest.balance))}
                </p>
              </div>
              <div className="card">
                <span className="card-title">LOWEST DATE</span>
                <p className="text-2xl font-bold text-content-primary">
                  {new Date(lowest.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })()}

      <div className="space-y-4">
        <h2 className="text-section text-content-primary">Recurring Transactions</h2>

        {(recurringQuery.isLoading || detectedQuery.isLoading) && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex items-center gap-4 py-4">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-36" />
                  <div className="skeleton h-3 w-48" />
                </div>
                <div className="skeleton h-5 w-20" />
              </div>
            ))}
          </div>
        )}
        {recurringQuery.isError && (
          <div className="card">
            <p className="text-accent-red text-sm">{recurringQuery.error.message}</p>
          </div>
        )}

        {detected.length > 0 && (
          <div className="card border-accent-yellow/30">
            <span className="card-title text-accent-yellow">DETECTED PATTERNS</span>
            <div className="space-y-3 mt-3">
              {detected.map((r) => (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-yellow/10">
                    <RefreshCw size={14} className="text-accent-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary">{r.merchant}</p>
                    <p className="text-xs text-content-tertiary">
                      ${formatCurrency(Number(r.expectedAmount))} · {r.frequency} · Next expected{' '}
                      {new Date(r.nextExpected).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmMutation.mutate(r.id)}
                      className="btn-ghost p-2 text-content-tertiary hover:text-accent-green"
                      title="Confirm"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => dismissMutation.mutate(r.id)}
                      className="btn-ghost p-2 text-content-tertiary hover:text-accent-red"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmed.length > 0 && (
          <div className="space-y-2">
            {confirmed.map((r) => (
              <div
                key={r.id}
                className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-green/10">
                  <RefreshCw size={14} className="text-accent-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary">{r.merchant}</p>
                  <p className="text-xs text-content-tertiary">
                    {r.frequency} · Next expected {new Date(r.nextExpected).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-content-primary">
                  ${formatCurrency(Number(r.expectedAmount))}
                </p>
                <button
                  type="button"
                  onClick={() => deactivateMutation.mutate(r.id)}
                  className="btn-ghost p-2 text-content-tertiary hover:text-accent-yellow"
                  title="Stop monitoring this recurring bill"
                  aria-label={`Stop monitoring ${r.merchant}`}
                  disabled={deactivateMutation.isPending}
                >
                  <PauseCircle size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {recurringQuery.data &&
          detectedQuery.data &&
          confirmed.length === 0 &&
          detected.length === 0 && (
            <div className="card text-center py-12">
              <RefreshCw size={40} className="mx-auto text-content-tertiary mb-3" />
              <p className="text-content-secondary text-sm">
                No recurring transactions detected yet
              </p>
              <p className="text-content-tertiary text-xs mt-1">
                Add more transactions and patterns will be automatically detected
              </p>
            </div>
          )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-section text-content-primary">Cash Flow Forecast (90 days)</h2>
          <div className="w-56">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input"
            >
              {accountsQuery.isLoading && <option value="">Loading accounts...</option>}
              {accountsQuery.data && accountsQuery.data.length === 0 && (
                <option value="">No accounts</option>
              )}
              {accountsQuery.data?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {cashFlowQuery.isLoading && (
          <div className="card space-y-3">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-64 w-full" />
          </div>
        )}
        {cashFlowQuery.isError && (
          <div className="card">
            <p className="text-accent-red text-sm">{cashFlowQuery.error.message}</p>
          </div>
        )}

        {cashFlowQuery.data && cashFlowQuery.data.projections.length > 0 && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                      Debits
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {cashFlowQuery.data.projections.slice(0, 30).map((p, i) => (
                    <tr key={i} className="hover:bg-surface-elevated transition-colors">
                      <td className="px-6 py-3 text-content-secondary">
                        {new Date(p.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-accent-green">
                        ${formatCurrency(Number(p.credits))}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-accent-red">
                        ${formatCurrency(Number(p.debits))}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-content-primary font-medium">
                        ${formatCurrency(Number(p.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cashFlowQuery.data && cashFlowQuery.data.projections.length === 0 && (
          <div className="card text-center py-12">
            <CalendarClock size={40} className="mx-auto text-content-tertiary mb-3" />
            <p className="text-content-secondary text-sm">No forecast data available</p>
            <p className="text-content-tertiary text-xs mt-1">
              Confirm recurring transactions to see your cash flow projection
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
