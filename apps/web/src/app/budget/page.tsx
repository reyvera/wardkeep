'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface CategoryProgress {
  categoryId: string;
  allocated: string;
  spent: string;
  remaining: string;
  percentUsed: string;
  status: string;
}

interface BudgetSummary {
  totalAllocated: string;
  totalSpent: string;
  totalRemaining: string;
  overspentCount: number;
  categoryProgress: CategoryProgress[];
}

interface BudgetDetail {
  id: string;
  allocations: Array<{ categoryId: string; amount: string }>;
}

interface Category {
  id: string;
  name: string;
}

interface AllocationInput {
  categoryId: string;
  amount: string;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function navigateMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y!, m! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y!, m! - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(getCurrentMonth);
  const [showForm, setShowForm] = useState(false);
  const [allocations, setAllocations] = useState<AllocationInput[]>([{ categoryId: '', amount: '' }]);

  const isCurrentMonth = month === getCurrentMonth();

  const budgetQuery = useQuery({
    queryKey: ['budget-summary', month],
    queryFn: () => apiClient.get<BudgetSummary>(`/budgets/${month}/summary`).catch(() => null),
  });

  const budgetDetailQuery = useQuery({
    queryKey: ['budget-detail', month],
    queryFn: () => apiClient.get<BudgetDetail>(`/budgets/${month}`).catch(() => null),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories'),
  });

  // Auto-copy from previous month if no budget exists for current month
  const copyMutation = useMutation({
    mutationFn: () => apiClient.post('/budgets/copy', { month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (budgetId: string) =>
      apiClient.patch(`/budgets/${budgetId}`, {
        allocations: allocations
          .filter((a) => a.categoryId && a.amount)
          .map((a) => ({ categoryId: a.categoryId, amount: a.amount })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
      setShowForm(false);
    },
  });

  const hasBudget = !!budgetDetailQuery.data?.id;

  // Auto-copy: if current month has no budget but previous month does, offer to copy
  const showAutoCopy = isCurrentMonth && !hasBudget && !budgetDetailQuery.isLoading;

  useEffect(() => {
    setShowForm(false);
  }, [month]);

  const startEditing = () => {
    if (budgetDetailQuery.data?.allocations) {
      setAllocations(
        budgetDetailQuery.data.allocations.map((a) => ({
          categoryId: a.categoryId,
          amount: a.amount,
        })),
      );
    } else {
      setAllocations([{ categoryId: '', amount: '' }]);
    }
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBudget) {
      updateMutation.mutate(budgetDetailQuery.data!.id);
    } else {
      createMutation.mutate();
    }
  };

  const addRow = () => setAllocations([...allocations, { categoryId: '', amount: '' }]);
  const removeRow = (i: number) => setAllocations(allocations.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof AllocationInput, value: string) => {
    const updated = [...allocations];
    updated[i] = { ...updated[i]!, [field]: value };
    setAllocations(updated);
  };

  const getCategoryName = (id: string) =>
    categoriesQuery.data?.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Budget</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(navigateMonth(month, -1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setMonth(getCurrentMonth())}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 font-medium"
          >
            Today
          </button>
          <button
            onClick={() => setMonth(navigateMonth(month, 1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Current month display */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">{formatMonth(month)}</h2>
        {hasBudget && isCurrentMonth && (
          <button
            onClick={startEditing}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-blue-700"
          >
            Edit Budget
          </button>
        )}
      </div>

      {/* Auto-copy prompt */}
      {showAutoCopy && (
        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-800 mb-3">
            No budget set for {formatMonth(month)}. Would you like to copy from last month or create a new one?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {copyMutation.isPending ? 'Copying...' : 'Copy from Last Month'}
            </button>
            <button
              onClick={startEditing}
              className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Create New Budget
            </button>
          </div>
          {copyMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{copyMutation.error.message}</p>
          )}
        </div>
      )}

      {/* No budget for past/future months */}
      {!hasBudget && !isCurrentMonth && !budgetDetailQuery.isLoading && (
        <div className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-6 text-center">
          <p className="text-gray-500">No budget was set for {formatMonth(month)}.</p>
        </div>
      )}

      {(createMutation.isError || updateMutation.isError) && (
        <p className="mb-4 text-sm text-red-600">
          {createMutation.error?.message ?? updateMutation.error?.message}
        </p>
      )}

      {/* Edit/Create form */}
      {showForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {hasBudget ? 'Edit' : 'Create'} Budget — {formatMonth(month)}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            {allocations.map((alloc, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <select
                  value={alloc.categoryId}
                  onChange={(e) => updateRow(idx, 'categoryId', e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount"
                  value={alloc.amount}
                  onChange={(e) => updateRow(idx, 'amount', e.target.value)}
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {allocations.length > 1 && (
                  <button type="button" onClick={() => removeRow(idx)} className="text-red-500 text-sm">✕</button>
                )}
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={addRow} className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                + Add Category
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-md bg-green-600 px-3 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Budget'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget summary */}
      {budgetQuery.data && (
        <>
          <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
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
          {budgetQuery.data.categoryProgress && budgetQuery.data.categoryProgress.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold">Category Breakdown</h2>
              {budgetQuery.data.categoryProgress.map((cp) => {
                const pct = Math.min(Number(cp.percentUsed), 100);
                const isOver = Number(cp.remaining) < 0;
                return (
                  <div key={cp.categoryId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{getCategoryName(cp.categoryId)}</span>
                      <span className="text-gray-500">
                        ${Number(cp.spent).toFixed(2)} / ${Number(cp.allocated).toFixed(2)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-3 rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {isOver ? 'Over by' : 'Remaining:'} ${Math.abs(Number(cp.remaining)).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
