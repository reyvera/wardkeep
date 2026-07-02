'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Copy, Edit3, Plus, X, PieChart } from 'lucide-react';
import { CategoryIcon, getCategoryIcon } from '@/components/category-icon';

interface CategoryProgress {
  categoryId: string;
  categoryName?: string;
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

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(getCurrentMonth);
  const [showForm, setShowForm] = useState(false);
  const [allocations, setAllocations] = useState<AllocationInput[]>([{ categoryId: '', amount: '' }]);

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

  const copyMutation = useMutation({
    mutationFn: () => apiClient.post('/budgets/copy', { month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
    },
  });

  const overwriteCopyMutation = useMutation({
    mutationFn: async () => {
      if (budgetDetailQuery.data?.id) {
        await apiClient.delete(`/budgets/${budgetDetailQuery.data.id}`);
      }
      return apiClient.post('/budgets/copy', { month });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/budgets', {
        month,
        allocations: allocations.filter((a) => a.categoryId && a.amount).map((a) => ({ categoryId: a.categoryId, amount: a.amount })),
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
        allocations: allocations.filter((a) => a.categoryId && a.amount).map((a) => ({ categoryId: a.categoryId, amount: a.amount })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', month] });
      queryClient.invalidateQueries({ queryKey: ['budget-detail', month] });
      setShowForm(false);
    },
  });

  const hasBudget = !!budgetDetailQuery.data?.id;

  useEffect(() => { setShowForm(false); }, [month]);

  const startEditing = () => {
    if (budgetDetailQuery.data?.allocations) {
      setAllocations(budgetDetailQuery.data.allocations.map((a) => ({ categoryId: a.categoryId, amount: a.amount })));
    } else {
      setAllocations([{ categoryId: '', amount: '' }]);
    }
    setShowForm(true);
  };

  const handleCopyFromPrevious = () => {
    if (hasBudget) {
      if (confirm(`This will overwrite the existing budget for ${formatMonth(month)}. Continue?`)) {
        overwriteCopyMutation.mutate();
      }
    } else {
      copyMutation.mutate();
    }
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

  const getCategoryName = (id: string) => categoriesQuery.data?.find((c) => c.id === id)?.name ?? id;

  const totalAllocated = Number(budgetQuery.data?.totalAllocated ?? 0);
  const totalSpent = Number(budgetQuery.data?.totalSpent ?? 0);
  const totalRemaining = Number(budgetQuery.data?.totalRemaining ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Budget</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(navigateMonth(month, -1))} className="btn-ghost p-2"><ChevronLeft size={16} /></button>
          <button onClick={() => setMonth(getCurrentMonth())} className="btn-secondary text-xs px-3 py-1.5">{formatMonth(month)}</button>
          <button onClick={() => setMonth(navigateMonth(month, 1))} className="btn-ghost p-2"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Summary Cards */}
      {budgetQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <span className="card-title">ALLOCATED</span>
            <p className="text-2xl font-bold tabular-nums text-content-primary">${formatCurrency(totalAllocated)}</p>
          </div>
          <div className="card">
            <span className="card-title">SPENT</span>
            <p className="text-2xl font-bold tabular-nums text-accent-red">${formatCurrency(totalSpent)}</p>
          </div>
          <div className="card">
            <span className="card-title">REMAINING</span>
            <p className={`text-2xl font-bold tabular-nums ${totalRemaining >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              ${formatCurrency(Math.abs(totalRemaining))}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={handleCopyFromPrevious} disabled={copyMutation.isPending || overwriteCopyMutation.isPending} className="btn-secondary text-xs">
          <Copy size={14} /> {(copyMutation.isPending || overwriteCopyMutation.isPending) ? 'Copying...' : 'Copy Previous'}
        </button>
        <button onClick={startEditing} className="btn-primary text-xs">
          {hasBudget ? <><Edit3 size={14} /> Edit Budget</> : <><Plus size={14} /> Create Budget</>}
        </button>
      </div>

      {(copyMutation.isError || overwriteCopyMutation.isError) && (
        <p className="text-sm text-accent-red">{copyMutation.error?.message ?? overwriteCopyMutation.error?.message}</p>
      )}

      {/* Empty state */}
      {!hasBudget && !budgetDetailQuery.isLoading && !showForm && (
        <div className="card text-center py-12">
          <PieChart size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary text-sm">No budget set for {formatMonth(month)}</p>
          <p className="text-content-tertiary text-xs mt-1">Create one or copy from the previous month</p>
        </div>
      )}

      {/* Edit/Create form */}
      {showForm && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">{hasBudget ? 'Edit' : 'Create'} Budget</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X size={16} /></button>
          </div>
          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-accent-red">{createMutation.error?.message ?? updateMutation.error?.message}</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            {allocations.map((alloc, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <select value={alloc.categoryId} onChange={(e) => updateRow(idx, 'categoryId', e.target.value)} className="input flex-1">
                  <option value="">Select category...</option>
                  {(categoriesQuery.data ?? []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <input type="number" step="0.01" min="0.01" placeholder="Amount" value={alloc.amount} onChange={(e) => updateRow(idx, 'amount', e.target.value)} className="input w-32" />
                {allocations.length > 1 && (
                  <button type="button" onClick={() => removeRow(idx)} className="btn-ghost p-1 text-accent-red"><X size={14} /></button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={addRow} className="btn-secondary text-xs"><Plus size={14} /> Add</button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary text-xs">
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Progress */}
      {budgetQuery.data?.categoryProgress && budgetQuery.data.categoryProgress.length > 0 && (
        <div className="card space-y-4">
          <span className="card-title">CATEGORY BREAKDOWN</span>
          {budgetQuery.data.categoryProgress
            .sort((a, b) => Number(b.spent) - Number(a.spent))
            .map((cp) => {
              const pct = Math.min(Number(cp.percentUsed), 100);
              const isOver = Number(cp.remaining) < 0;
              const catName = getCategoryName(cp.categoryId);
              const catIcon = getCategoryIcon(catName);
              return (
                <div key={cp.categoryId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <CategoryIcon name={catName} size="sm" />
                      <span className="text-sm font-medium text-content-primary">{catName}</span>
                    </div>
                    <span className="text-xs text-content-secondary tabular-nums">
                      ${formatCurrency(Number(cp.spent))} / ${formatCurrency(Number(cp.allocated))}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: isOver ? 'var(--accent-red)' : pct > 80 ? 'var(--accent-yellow)' : catIcon.color,
                      }}
                    />
                  </div>
                  <p className={`text-[10px] mt-1 ${isOver ? 'text-accent-red' : 'text-content-tertiary'}`}>
                    {isOver ? `$${formatCurrency(Math.abs(Number(cp.remaining)))} over` : `$${formatCurrency(Number(cp.remaining))} left`}
                  </p>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
