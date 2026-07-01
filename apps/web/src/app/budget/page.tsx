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

interface Category {
  id: string;
  name: string;
}

interface AllocationInput {
  categoryId: string;
  amount: string;
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [allocations, setAllocations] = useState<AllocationInput[]>([{ categoryId: '', amount: '' }]);

  const budgetQuery = useQuery({
    queryKey: ['budget', month],
    queryFn: () => apiClient.get<BudgetSummary>(`/budgets/${month}/summary`),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/budgets', {
        month,
        allocations: allocations
          .filter((a) => a.categoryId && a.amount)
          .map((a) => ({ categoryId: a.categoryId, amount: a.amount })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', month] });
      setShowCreateForm(false);
      setAllocations([{ categoryId: '', amount: '' }]);
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => apiClient.post('/budgets/copy', { month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget', month] }),
  });

  const addAllocationRow = () => {
    setAllocations([...allocations, { categoryId: '', amount: '' }]);
  };

  const updateAllocation = (index: number, field: keyof AllocationInput, value: string) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index]!, [field]: value };
    setAllocations(updated);
  };

  const removeAllocationRow = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const hasBudget = budgetQuery.data?.categories && budgetQuery.data.categories.length > 0;

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
          {!hasBudget && (
            <>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="rounded-md bg-blue-600 px-3 py-2 text-white text-sm font-medium hover:bg-blue-700"
              >
                {showCreateForm ? 'Cancel' : 'Create Budget'}
              </button>
              <button
                onClick={() => copyMutation.mutate()}
                disabled={copyMutation.isPending}
                className="rounded-md bg-gray-600 px-3 py-2 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {copyMutation.isPending ? 'Copying...' : 'Copy Previous'}
              </button>
            </>
          )}
        </div>
      </div>

      {createMutation.isError && (
        <p className="mb-4 text-sm text-red-600">{createMutation.error.message}</p>
      )}
      {copyMutation.isError && (
        <p className="mb-4 text-sm text-red-600">{copyMutation.error.message}</p>
      )}

      {showCreateForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Set Budget for {month}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-3"
          >
            {allocations.map((alloc, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <select
                  value={alloc.categoryId}
                  onChange={(e) => updateAllocation(idx, 'categoryId', e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount"
                  value={alloc.amount}
                  onChange={(e) => updateAllocation(idx, 'amount', e.target.value)}
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {allocations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAllocationRow(idx)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={addAllocationRow}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                + Add Category
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-md bg-green-600 px-3 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Save Budget'}
              </button>
            </div>
          </form>
        </div>
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
            {(!budgetQuery.data.categories || budgetQuery.data.categories.length === 0) && (
              <p className="text-gray-500">No budget categories set for this month.</p>
            )}
            {(budgetQuery.data.categories ?? []).map((cat) => {
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
