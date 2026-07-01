'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const netWorthQuery = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => apiClient.get<NetWorth>('/accounts/net-worth'),
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const budgetQuery = useQuery({
    queryKey: ['budget-summary', getCurrentMonth()],
    queryFn: () => apiClient.get<BudgetSummary>(`/budgets/${getCurrentMonth()}/summary`).catch(() => null),
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
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

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
            Budget — {new Date().toLocaleDateString('en-US', { month: 'long' })}
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
