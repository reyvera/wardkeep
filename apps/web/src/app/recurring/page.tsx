'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface RecurringTransaction {
  id: string;
  merchant: string;
  amount: number;
  frequency: string;
  nextDate: string;
  isConfirmed: boolean;
}

interface CashFlowProjection {
  date: string;
  balance: number;
  income: number;
  expenses: number;
}

interface CashFlowSummary {
  projections: CashFlowProjection[];
  endBalance: number;
  lowestBalance: number;
  lowestDate: string;
}

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');

  const recurringQuery = useQuery({
    queryKey: ['recurring'],
    queryFn: () => apiClient.get<RecurringTransaction[]>('/recurring'),
  });

  const cashFlowQuery = useQuery({
    queryKey: ['cashflow', accountId],
    queryFn: () =>
      apiClient.get<CashFlowSummary>(
        `/cashflow/forecast${accountId ? `?accountId=${accountId}` : ''}`,
      ),
    enabled: true,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/recurring/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/recurring/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });

  const confirmed = recurringQuery.data?.filter((r) => r.isConfirmed) ?? [];
  const detected = recurringQuery.data?.filter((r) => !r.isConfirmed) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cash Flow &amp; Recurring</h1>

      {/* Recurring Transactions Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Recurring Transactions</h2>

        {recurringQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {recurringQuery.isError && <p className="text-red-600">{recurringQuery.error.message}</p>}

        {/* Confirmed */}
        {confirmed.length > 0 && (
          <div className="rounded-lg bg-white p-4 shadow-sm mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Confirmed</h3>
            <ul className="divide-y text-sm">
              {confirmed.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{r.merchant}</span>
                    <span className="text-gray-500 ml-2">
                      ${Number(r.amount).toFixed(2)} · {r.frequency} · Next: {r.nextDate}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detected patterns */}
        {detected.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">Detected Patterns</h3>
            <ul className="divide-y divide-yellow-100 text-sm">
              {detected.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{r.merchant}</span>
                    <span className="text-gray-600 ml-2">
                      ${Number(r.amount).toFixed(2)} · {r.frequency}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmMutation.mutate(r.id)}
                      className="text-xs rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => dismissMutation.mutate(r.id)}
                      className="text-xs rounded bg-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-400"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recurringQuery.data && confirmed.length === 0 && detected.length === 0 && (
          <p className="text-gray-500">No recurring transactions detected yet.</p>
        )}
      </div>

      {/* Cash Flow Forecast Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cash Flow Forecast (90 days)</h2>
          <input
            placeholder="Account ID (optional)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm w-56"
          />
        </div>

        {cashFlowQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {cashFlowQuery.isError && <p className="text-red-600">{cashFlowQuery.error.message}</p>}
        {cashFlowQuery.data && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">End Balance (90d)</p>
                <p className="text-xl font-bold">
                  ${Number(cashFlowQuery.data.endBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lowest Balance</p>
                <p className="text-xl font-bold text-red-600">
                  ${Number(cashFlowQuery.data.lowestBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lowest Date</p>
                <p className="text-xl font-bold">{cashFlowQuery.data.lowestDate}</p>
              </div>
            </div>
            {cashFlowQuery.data.projections.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium text-right">Income</th>
                      <th className="px-3 py-2 font-medium text-right">Expenses</th>
                      <th className="px-3 py-2 font-medium text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cashFlowQuery.data.projections.slice(0, 30).map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{p.date}</td>
                        <td className="px-3 py-2 text-right text-green-600">${Number(p.income).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-red-600">${Number(p.expenses).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">${Number(p.balance).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
