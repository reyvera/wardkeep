'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface NetWorth {
  assets: string;
  liabilities: string;
  netWorth: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: string;
}

interface BudgetSummary {
  totalAllocated: string;
  totalSpent: string;
  totalRemaining: string;
  overspentCount: number;
  categoryProgress: Array<{
    categoryId: string;
    allocated: string;
    spent: string;
    percentUsed: string;
  }>;
}

interface SpendingStats {
  monthlyTrend: Array<{ month: string; income: number; expenses: number }>;
  spendingByCategory: Array<{ categoryId: string; name: string; amount: number }>;
  topMerchants: Array<{ merchant: string; amount: number }>;
}

const PIE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

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

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth);

  const netWorthQuery = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => apiClient.get<NetWorth>('/accounts/net-worth'),
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const budgetQuery = useQuery({
    queryKey: ['budget-summary', month],
    queryFn: () => apiClient.get<BudgetSummary>(`/budgets/${month}/summary`).catch(() => null),
  });

  const statsQuery = useQuery({
    queryKey: ['spending-stats', month],
    queryFn: () => apiClient.get<SpendingStats>(`/transactions/stats?month=${month}`),
  });

  const assets = Number(netWorthQuery.data?.assets ?? 0);
  const liabilities = Number(netWorthQuery.data?.liabilities ?? 0);
  const netWorth = Number(netWorthQuery.data?.netWorth ?? 0);

  const budgetAllocated = Number(budgetQuery.data?.totalAllocated ?? 0);
  const budgetSpent = Number(budgetQuery.data?.totalSpent ?? 0);
  const budgetRemaining = Number(budgetQuery.data?.totalRemaining ?? 0);
  const budgetPct = budgetAllocated > 0 ? Math.min(100, (budgetSpent / budgetAllocated) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(navigateMonth(month, -1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            ←
          </button>
          <button
            onClick={() => setMonth(getCurrentMonth())}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {formatMonth(month)}
          </button>
          <button
            onClick={() => setMonth(navigateMonth(month, 1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Net Worth Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Net Worth</p>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-green-600">
            ${assets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600">
            ${liabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Accounts breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Accounts</h2>
          {accountsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
          {accountsQuery.data && accountsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {accountsQuery.data.map((acc) => {
                const bal = Number(acc.currentBalance);
                const isDebt = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC'].includes(acc.type);
                return (
                  <div key={acc.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{acc.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{acc.type.replace('_', ' ').toLowerCase()}</p>
                    </div>
                    <p className={`font-mono font-semibold ${isDebt ? 'text-red-600' : 'text-gray-900'}`}>
                      ${Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No accounts yet.</p>
          )}
        </div>

        {/* Budget progress this month */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Budget — {formatMonth(month)}
          </h2>
          {budgetQuery.data ? (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">
                  ${budgetSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} spent
                </span>
                <span className="text-gray-500">
                  ${budgetAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })} allocated
                </span>
              </div>
              <div className="h-4 w-full rounded-full bg-gray-200 mb-3">
                <div
                  className={`h-4 rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className={`text-sm font-medium ${budgetRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {budgetRemaining >= 0
                  ? `$${budgetRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining`
                  : `$${Math.abs(budgetRemaining).toLocaleString('en-US', { minimumFractionDigits: 2 })} over budget`}
              </p>

              {/* Top spending categories */}
              {budgetQuery.data.categoryProgress && budgetQuery.data.categoryProgress.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {budgetQuery.data.categoryProgress
                    .sort((a, b) => Number(b.spent) - Number(a.spent))
                    .slice(0, 5)
                    .map((cp) => {
                      const pct = Math.min(Number(cp.percentUsed), 100);
                      return (
                        <div key={cp.categoryId}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-600">{cp.categoryId.slice(0, 8)}...</span>
                            <span className="text-gray-500">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div
                              className={`h-2 rounded-full ${pct > 100 ? 'bg-red-400' : 'bg-blue-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No budget set for this month.</p>
          )}
        </div>
      </div>

      {/* Net Worth Bar Visualization */}
      <div className="rounded-lg bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Assets vs Liabilities</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Assets</span>
              <span className="font-medium text-green-600">
                ${assets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-6 rounded bg-green-100">
              <div
                className="h-6 rounded bg-green-500"
                style={{ width: `${assets + liabilities > 0 ? (assets / (assets + liabilities)) * 100 : 50}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Liabilities</span>
              <span className="font-medium text-red-600">
                ${liabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-6 rounded bg-red-100">
              <div
                className="h-6 rounded bg-red-500"
                style={{ width: `${assets + liabilities > 0 ? (liabilities / (assets + liabilities)) * 100 : 50}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {statsQuery.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Income vs Expenses Trend */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Income vs Expenses (6 months)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statsQuery.data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending by Category Pie */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Spending by Category (This Month)</h2>
            {statsQuery.data.spendingByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statsQuery.data.spendingByCategory}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {statsQuery.data.spendingByCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No categorized spending this month.</p>
            )}
          </div>
        </div>
      )}

      {/* Top Merchants */}
      {statsQuery.data && statsQuery.data.topMerchants.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Top Merchants (This Month)</h2>
          <div className="space-y-2">
            {statsQuery.data.topMerchants.map((m, i) => {
              const maxAmount = statsQuery.data!.topMerchants[0]!.amount;
              const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-gray-700 truncate max-w-[200px]">{m.merchant}</span>
                    <span className="font-mono text-gray-600">${m.amount.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-800">{accountsQuery.data?.length ?? 0}</p>
          <p className="text-xs text-gray-500">Accounts</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-800">
            {accountsQuery.data?.filter((a) => ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC'].includes(a.type)).length ?? 0}
          </p>
          <p className="text-xs text-gray-500">Debts</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-800">{budgetQuery.data?.overspentCount ?? 0}</p>
          <p className="text-xs text-gray-500">Categories Over Budget</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold">{budgetPct.toFixed(0)}%</p>
          <p className="text-xs text-gray-500">Budget Used</p>
        </div>
      </div>
    </div>
  );
}
