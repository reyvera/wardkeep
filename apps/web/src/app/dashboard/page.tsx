'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  Wallet, CreditCard, Landmark, PiggyBank,
} from 'lucide-react';
import { CategoryIcon, getCategoryIcon } from '@/components/category-icon';

// ─── Types ──────────────────────────────────────────────────────────────────

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
    categoryName?: string;
    allocated: string;
    spent: string;
    percentUsed: string;
  }>;
}

interface SpendingStats {
  monthlyTrend: Array<{ month: string; income: number; expenses: number }>;
  spendingByCategory: Array<{ categoryId: string; name: string; amount: number }>;
  topMerchants: Array<{ merchant: string; amount: number }>;
  monthTotals: {
    income: number;
    expenses: number;
    daysElapsed: number;
    daysInMonth: number;
  };
}

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: string;
  date: string;
  categoryId?: string;
  categoryName?: string;
  merchant?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function getAccountIcon(type: string) {
  switch (type) {
    case 'CREDIT_CARD': return CreditCard;
    case 'LOAN': case 'MORTGAGE': return Landmark;
    case 'SAVINGS': return PiggyBank;
    default: return Wallet;
  }
}

const ACCOUNT_TYPE_ORDER = ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'MORTGAGE', 'CASH'];

function groupAccountsByType(accounts: Account[]) {
  const groups: Record<string, Account[]> = {};
  for (const acc of accounts) {
    const type = acc.type || 'OTHER';
    if (!groups[type]) groups[type] = [];
    groups[type].push(acc);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = ACCOUNT_TYPE_ORDER.indexOf(a);
    const bi = ACCOUNT_TYPE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function formatAccountType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────────────────────

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

  const recentTxQuery = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => apiClient.get<{ data: Transaction[] }>('/transactions?limit=5&sort=date&order=desc'),
  });

  const netWorth = Number(netWorthQuery.data?.netWorth ?? 0);
  const assets = Number(netWorthQuery.data?.assets ?? 0);
  const liabilities = Number(netWorthQuery.data?.liabilities ?? 0);

  const budgetAllocated = Number(budgetQuery.data?.totalAllocated ?? 0);
  const budgetSpent = Number(budgetQuery.data?.totalSpent ?? 0);
  const budgetRemaining = Number(budgetQuery.data?.totalRemaining ?? 0);

  const income = statsQuery.data?.monthTotals?.income ?? 0;
  const expenses = statsQuery.data?.monthTotals?.expenses ?? 0;
  const daysElapsed = statsQuery.data?.monthTotals?.daysElapsed ?? 0;
  const daysInMonth = statsQuery.data?.monthTotals?.daysInMonth ?? 30;
  const dailyRate = daysElapsed > 0 ? expenses / daysElapsed : 0;

  // Spending pace data for the area chart
  const paceData = Array.from({ length: daysElapsed || 1 }, (_, i) => ({
    day: i + 1,
    actual: Math.round(dailyRate * (i + 1) * 100) / 100,
    budget: budgetAllocated > 0 ? Math.round((budgetAllocated / daysInMonth) * (i + 1) * 100) / 100 : 0,
  }));

  const underOver = budgetAllocated > 0
    ? budgetAllocated - budgetSpent
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Dashboard</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(navigateMonth(month, -1))}
            className="btn-ghost p-2"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonth(getCurrentMonth())}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {formatMonth(month)}
          </button>
          <button
            onClick={() => setMonth(navigateMonth(month, 1))}
            className="btn-ghost p-2"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Spending Pace Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="card-title">SPENDING PACE</span>
          {budgetAllocated > 0 && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                underOver >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              ${Math.abs(underOver).toLocaleString('en-US', { maximumFractionDigits: 0 })} {underOver >= 0 ? 'under' : 'over'}
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={paceData}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, '']}
              labelFormatter={(day) => `Day ${day}`}
            />
            {budgetAllocated > 0 && (
              <Area type="monotone" dataKey="budget" stroke="var(--text-tertiary)" strokeDasharray="4 4" fill="none" strokeWidth={1} />
            )}
            <Area type="monotone" dataKey="actual" stroke="var(--accent-green)" fill="url(#spendGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Main Grid: 3 columns on large, 2 on medium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Net Worth Card */}
        <div className="card">
          <span className="card-title">NET WORTH</span>
          <p className={`text-hero tabular-nums ${netWorth >= 0 ? 'text-content-primary' : 'text-accent-red'}`}>
            ${formatCurrency(netWorth)}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1 text-accent-green">
              <TrendingUp size={12} /> ${formatCurrency(assets)}
            </span>
            <span className="flex items-center gap-1 text-accent-red">
              <TrendingDown size={12} /> ${formatCurrency(liabilities)}
            </span>
          </div>
        </div>

        {/* Monthly Spending Card */}
        <div className="card">
          <span className="card-title">THIS MONTH</span>
          <div className="space-y-2 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-content-secondary">Income</span>
              <span className="amount-positive text-sm">+${formatCurrency(income)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-content-secondary">Spent</span>
              <span className="amount-negative text-sm">-${formatCurrency(expenses)}</span>
            </div>
            <div className="border-t border-edge pt-2 flex justify-between items-center">
              <span className="text-sm font-medium text-content-primary">Net</span>
              <span className={`text-sm font-bold tabular-nums ${income - expenses >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {income - expenses >= 0 ? '+' : ''}${formatCurrency(income - expenses)}
              </span>
            </div>
          </div>
        </div>

        {/* Budget Card */}
        <div className="card">
          <span className="card-title">BUDGET</span>
          {budgetAllocated > 0 ? (
            <>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-lg font-bold tabular-nums text-content-primary">
                  ${formatCurrency(budgetSpent)}
                </span>
                <span className="text-xs text-content-tertiary">
                  of ${formatCurrency(budgetAllocated)}
                </span>
              </div>
              <div className="progress-track mt-3">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, (budgetSpent / budgetAllocated) * 100)}%`,
                    background: budgetSpent / budgetAllocated > 0.9
                      ? 'var(--accent-red)'
                      : budgetSpent / budgetAllocated > 0.7
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-blue)',
                  }}
                />
              </div>
              <p className={`text-xs mt-2 font-medium ${budgetRemaining >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {budgetRemaining >= 0 ? `$${formatCurrency(budgetRemaining)} left` : `$${formatCurrency(Math.abs(budgetRemaining))} over`}
              </p>
            </>
          ) : (
            <p className="text-sm text-content-tertiary mt-2">No budget set</p>
          )}
        </div>
      </div>

      {/* Second Row: Accounts + Top Categories + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Accounts */}
        <div className="card">
          <span className="card-title">ACCOUNTS</span>
          {accountsQuery.data && accountsQuery.data.length > 0 ? (
            <div className="space-y-4 mt-2">
              {groupAccountsByType(accountsQuery.data).map(([type, accounts]) => (
                <div key={type}>
                  <p className="text-[10px] uppercase tracking-wider text-content-tertiary font-medium mb-1.5">
                    {formatAccountType(type)}
                  </p>
                  <div className="space-y-1.5">
                    {accounts.map((acc) => {
                      const bal = Number(acc.currentBalance);
                      const Icon = getAccountIcon(acc.type);
                      const isDebt = ['CREDIT_CARD', 'LOAN', 'MORTGAGE'].includes(acc.type);
                      return (
                        <div key={acc.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-content-tertiary" />
                            <span className="text-sm text-content-primary truncate max-w-[120px]">{acc.name}</span>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${isDebt ? 'text-accent-red' : 'text-content-primary'}`}>
                            {isDebt ? '-' : ''}${formatCurrency(Math.abs(bal))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-tertiary mt-2">No accounts yet</p>
          )}
        </div>

        {/* Top Categories */}
        <div className="card">
          <span className="card-title">TOP CATEGORIES</span>
          {statsQuery.data && statsQuery.data.spendingByCategory.length > 0 ? (
            <div className="space-y-2.5 mt-2">
              {statsQuery.data.spendingByCategory.slice(0, 6).map((cat, i) => (
                <div key={cat.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryIcon name={cat.name} size="sm" />
                    <span className="text-sm text-content-primary truncate max-w-[120px]">{cat.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-content-primary">
                    ${formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-tertiary mt-2">No spending data</p>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="card-title">RECENT</span>
          </div>
          {recentTxQuery.data?.data && recentTxQuery.data.data.length > 0 ? (
            <div className="space-y-2 mt-2">
              {(recentTxQuery.data.data as Transaction[]).slice(0, 5).map((tx) => {
                const amt = Number(tx.amount);
                const isCredit = tx.type === 'CREDIT';
                return (
                  <div key={tx.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CategoryIcon name={tx.categoryName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm text-content-primary truncate">
                          {tx.merchant || tx.description}
                        </p>
                        {tx.categoryName && (
                          <span
                            className="category-pill text-[10px] mt-0.5"
                            style={{
                              backgroundColor: `${getCategoryIcon(tx.categoryName).color}15`,
                              color: getCategoryIcon(tx.categoryName).color,
                            }}
                          >
                            {tx.categoryName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ml-3 ${isCredit ? 'text-accent-green' : 'text-content-primary'}`}>
                      {isCredit ? '+' : ''}${formatCurrency(amt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-content-tertiary mt-2">No transactions yet</p>
          )}
        </div>
      </div>

      {/* Third Row: Income vs Expenses Trend */}
      {statsQuery.data && statsQuery.data.monthlyTrend.length > 0 && (
        <div className="card">
          <span className="card-title">INCOME VS EXPENSES (6 MONTHS)</span>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={statsQuery.data.monthlyTrend}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" fontSize={11} stroke="var(--text-tertiary)" tickLine={false} axisLine={false} />
              <YAxis fontSize={11} stroke="var(--text-tertiary)" tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                formatter={(value) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '']}
              />
              <Area type="monotone" dataKey="income" stroke="var(--accent-green)" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="var(--accent-red)" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Merchants */}
      {statsQuery.data && statsQuery.data.topMerchants.length > 0 && (
        <div className="card">
          <span className="card-title">TOP MERCHANTS</span>
          <div className="space-y-2.5 mt-2">
            {statsQuery.data.topMerchants.slice(0, 5).map((m, i) => {
              const maxAmount = statsQuery.data!.topMerchants[0]!.amount;
              const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-content-primary truncate max-w-[200px]">{m.merchant}</span>
                    <span className="font-semibold tabular-nums text-content-primary">${m.amount.toFixed(2)}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: 'var(--accent-purple)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
