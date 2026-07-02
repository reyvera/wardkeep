'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { RefreshCw, Check, X, CalendarClock } from 'lucide-react';

interface RecurringTransaction { id: string; merchant: string; amount: number; frequency: string; nextDate: string; isConfirmed: boolean; }
interface CashFlowProjection { date: string; balance: number; income: number; expenses: number; }
interface CashFlowSummary { projections: CashFlowProjection[]; endBalance: number; lowestBalance: number; lowestDate: string; }

function formatCurrency(value: number): string { return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');

  const recurringQuery = useQuery({ queryKey: ['recurring'], queryFn: () => apiClient.get<RecurringTransaction[]>('/recurring') });
  const cashFlowQuery = useQuery({ queryKey: ['cashflow', accountId], queryFn: () => apiClient.get<CashFlowSummary>(`/cashflow/forecast${accountId ? `?accountId=${accountId}` : ''}`), enabled: true });

  const confirmMutation = useMutation({ mutationFn: (id: string) => apiClient.post(`/recurring/${id}/confirm`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }) });
  const dismissMutation = useMutation({ mutationFn: (id: string) => apiClient.post(`/recurring/${id}/dismiss`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }) });

  const confirmed = recurringQuery.data?.filter((r) => r.isConfirmed) ?? [];
  const detected = recurringQuery.data?.filter((r) => !r.isConfirmed) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Cash Flow &amp; Recurring</h1>

      {cashFlowQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card"><span className="card-title">END BALANCE (90D)</span><p className="text-2xl font-bold tabular-nums text-content-primary">${formatCurrency(Number(cashFlowQuery.data.endBalance))}</p></div>
          <div className="card"><span className="card-title">LOWEST BALANCE</span><p className="text-2xl font-bold tabular-nums text-accent-red">${formatCurrency(Number(cashFlowQuery.data.lowestBalance))}</p></div>
          <div className="card"><span className="card-title">LOWEST DATE</span><p className="text-2xl font-bold text-content-primary">{cashFlowQuery.data.lowestDate}</p></div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-section text-content-primary">Recurring Transactions</h2>

        {recurringQuery.isLoading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card flex items-center gap-4 py-4"><div className="skeleton w-8 h-8 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-36" /><div className="skeleton h-3 w-48" /></div><div className="skeleton h-5 w-20" /></div>)}</div>}
        {recurringQuery.isError && <div className="card"><p className="text-accent-red text-sm">{recurringQuery.error.message}</p></div>}

        {detected.length > 0 && (
          <div className="card border-accent-yellow/30">
            <span className="card-title text-accent-yellow">DETECTED PATTERNS</span>
            <div className="space-y-3 mt-3">
              {detected.map((r) => (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-yellow/10"><RefreshCw size={14} className="text-accent-yellow" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-content-primary">{r.merchant}</p><p className="text-xs text-content-tertiary">${formatCurrency(Number(r.amount))} · {r.frequency}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmMutation.mutate(r.id)} className="btn-ghost p-2 text-content-tertiary hover:text-accent-green" title="Confirm"><Check size={14} /></button>
                    <button onClick={() => dismissMutation.mutate(r.id)} className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" title="Dismiss"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmed.length > 0 && (
          <div className="space-y-2">
            {confirmed.map((r) => (
              <div key={r.id} className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-green/10"><RefreshCw size={14} className="text-accent-green" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-content-primary">{r.merchant}</p><p className="text-xs text-content-tertiary">{r.frequency} · Next: {r.nextDate}</p></div>
                <p className="text-sm font-bold tabular-nums text-content-primary">${formatCurrency(Number(r.amount))}</p>
              </div>
            ))}
          </div>
        )}

        {recurringQuery.data && confirmed.length === 0 && detected.length === 0 && (
          <div className="card text-center py-12"><RefreshCw size={40} className="mx-auto text-content-tertiary mb-3" /><p className="text-content-secondary text-sm">No recurring transactions detected yet</p><p className="text-content-tertiary text-xs mt-1">Add more transactions and patterns will be automatically detected</p></div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-section text-content-primary">Cash Flow Forecast (90 days)</h2>
          <div className="w-56"><input placeholder="Filter by Account ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input" /></div>
        </div>

        {cashFlowQuery.isLoading && <div className="card space-y-3"><div className="skeleton h-6 w-48" /><div className="skeleton h-64 w-full" /></div>}
        {cashFlowQuery.isError && <div className="card"><p className="text-accent-red text-sm">{cashFlowQuery.error.message}</p></div>}

        {cashFlowQuery.data && cashFlowQuery.data.projections.length > 0 && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-edge"><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Date</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Income</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Expenses</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-edge">
                  {cashFlowQuery.data.projections.slice(0, 30).map((p, i) => (
                    <tr key={i} className="hover:bg-surface-elevated transition-colors"><td className="px-6 py-3 text-content-secondary">{p.date}</td><td className="px-6 py-3 text-right tabular-nums text-accent-green">${formatCurrency(Number(p.income))}</td><td className="px-6 py-3 text-right tabular-nums text-accent-red">${formatCurrency(Number(p.expenses))}</td><td className="px-6 py-3 text-right tabular-nums text-content-primary font-medium">${formatCurrency(Number(p.balance))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cashFlowQuery.data && cashFlowQuery.data.projections.length === 0 && (
          <div className="card text-center py-12"><CalendarClock size={40} className="mx-auto text-content-tertiary mb-3" /><p className="text-content-secondary text-sm">No forecast data available</p><p className="text-content-tertiary text-xs mt-1">Confirm recurring transactions to see your cash flow projection</p></div>
        )}
      </div>
    </div>
  );
}
