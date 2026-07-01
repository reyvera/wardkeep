'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface BudgetCategory {
  categoryId: string;
  categoryName: string;
  allocated: number;
  spent: number;
  remaining: number;
}

interface BudgetSummary {
  month: string;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  categories: BudgetCategory[];
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const budgetQuery = useQuery({
    queryKey: ['budget', month],
    queryFn: () => apiClient.get<BudgetSummary>(`/budgets/${month}/summary`),
  });

  const copyMutation = useMutation({
    mutationFn: () => apiClient.post(`/budgets/${month}/copy-previous`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget', month] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Budget</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending}
            className="rounded-md bg-gray-600 px-3 py-2 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {copyMutation.isPending ? 'Copying...' : 'Copy from Previous Month'}
          </button>
        </div>
      </div>

      {copyMutation.isError && (
        <p className="mb-4 text-sm text-red-600">{copyMutation.error.message}</p>
      )}

      {budgetQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {budgetQuery.isError && <p className="text-red-600">{budgetQuery.error.message}</p>}
      {budgetQuery.data && (
        <>
          {/* Summary card */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Summary for {budgetQuery.data.month}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Allocated</p>
                <p className="text-xl font-bold">
                  ${Number(budgetQuery.data.totalAllocated).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Spent</p>
                <p className="text-xl font-bold text-red-600">
                  ${Number(budgetQuery.data.totalSpent).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Remaining</p>
                <p className="text-xl font-bold text-green-600">
                  ${Number(budgetQuery.data.totalRemaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Category progress bars */}
          <div className="rounded-lg bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Categories</h2>
            {budgetQuery.data.categories.length === 0 && (
              <p className="text-gray-500">No budget categories set for this month.</p>
            )}
            {budgetQuery.data.categories.map((cat) => {
              const pct = cat.allocated > 0 ? Math.min(100, (cat.spent / cat.allocated) * 100) : 0;
              const isOver = cat.spent > cat.allocated;
              return (
                <div key={cat.categoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cat.categoryName}</span>
                    <span className="text-gray-500">
                      ${Number(cat.spent).toFixed(2)} / ${Number(cat.allocated).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-3 rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isOver ? 'Over budget by' : 'Remaining:'} $
                    {Math.abs(Number(cat.remaining)).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
