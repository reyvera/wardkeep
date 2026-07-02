'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Plus, Archive, Trash2, Wallet, CreditCard, Landmark, PiggyBank, Banknote, X,
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: string;
  isArchived: boolean;
}

function getAccountIcon(type: string) {
  switch (type) {
    case 'CREDIT_CARD': return CreditCard;
    case 'LOAN': case 'MORTGAGE': return Landmark;
    case 'SAVINGS': return PiggyBank;
    case 'CASH': return Banknote;
    default: return Wallet;
  }
}

function formatAccountType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [balance, setBalance] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/accounts', {
        name,
        type,
        initialBalance: balance || '0',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setName('');
      setType('CHECKING');
      setBalance('');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/accounts/${id}/permanent`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  // Compute totals
  const accounts = accountsQuery.data ?? [];
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const totalBalance = activeAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const debtTypes = ['CREDIT_CARD', 'LOAN', 'MORTGAGE'];
  const totalAssets = activeAccounts.filter((a) => !debtTypes.includes(a.type)).reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const totalLiabilities = activeAccounts.filter((a) => debtTypes.includes(a.type)).reduce((sum, a) => sum + Math.abs(Number(a.currentBalance)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={showForm ? 'btn-secondary' : 'btn-primary'}
        >
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Account</>}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <span className="card-title">NET WORTH</span>
          <p className={`text-2xl font-bold tabular-nums ${totalBalance >= 0 ? 'text-content-primary' : 'text-accent-red'}`}>
            ${formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="card">
          <span className="card-title">ASSETS</span>
          <p className="text-2xl font-bold tabular-nums text-accent-green">${formatCurrency(totalAssets)}</p>
        </div>
        <div className="card">
          <span className="card-title">LIABILITIES</span>
          <p className="text-2xl font-bold tabular-nums text-accent-red">${formatCurrency(totalLiabilities)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          {createMutation.isError && (
            <p className="text-sm text-accent-red">{createMutation.error.message}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Account Name</label>
              <input
                placeholder="e.g. Chase Checking"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="input-label">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="LOAN">Loan</option>
                <option value="MORTGAGE">Mortgage</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="input-label">Opening Balance</label>
              <input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Save Account'}
          </button>
        </form>
      )}

      {/* Account List */}
      {accountsQuery.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-20" />
              </div>
              <div className="skeleton h-5 w-24" />
            </div>
          ))}
        </div>
      )}

      {accountsQuery.isError && (
        <div className="card">
          <p className="text-accent-red text-sm">{accountsQuery.error.message}</p>
        </div>
      )}

      {accounts.length > 0 ? (
        <div className="space-y-2">
          {activeAccounts.map((account) => {
            const bal = Number(account.currentBalance);
            const isDebt = debtTypes.includes(account.type);
            const Icon = getAccountIcon(account.type);
            return (
              <div
                key={account.id}
                className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated">
                  <Icon size={18} className="text-content-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">{account.name}</p>
                  <p className="text-xs text-content-tertiary">{formatAccountType(account.type)}</p>
                </div>
                <p className={`text-base font-bold tabular-nums ${isDebt ? 'text-accent-red' : 'text-content-primary'}`}>
                  {isDebt ? '-' : ''}${formatCurrency(Math.abs(bal))}
                </p>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => archiveMutation.mutate(account.id)}
                    className="btn-ghost p-2 text-content-tertiary hover:text-accent-yellow"
                    title="Archive"
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Permanently delete this account and all its transactions?')) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                    className="btn-ghost p-2 text-content-tertiary hover:text-accent-red"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Archived accounts */}
          {accounts.filter((a) => a.isArchived).length > 0 && (
            <details className="mt-4">
              <summary className="text-xs font-medium text-content-tertiary cursor-pointer hover:text-content-secondary">
                Archived accounts ({accounts.filter((a) => a.isArchived).length})
              </summary>
              <div className="space-y-2 mt-2 opacity-60">
                {accounts.filter((a) => a.isArchived).map((account) => {
                  const Icon = getAccountIcon(account.type);
                  return (
                    <div key={account.id} className="card flex items-center gap-4 py-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated">
                        <Icon size={18} className="text-content-tertiary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-content-secondary">{account.name}</p>
                        <p className="text-xs text-content-tertiary">{formatAccountType(account.type)}</p>
                      </div>
                      <p className="text-sm tabular-nums text-content-tertiary">
                        ${formatCurrency(Math.abs(Number(account.currentBalance)))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      ) : (
        !accountsQuery.isLoading && (
          <div className="card text-center py-12">
            <Wallet size={40} className="mx-auto text-content-tertiary mb-3" />
            <p className="text-content-secondary text-sm">No accounts yet</p>
            <p className="text-content-tertiary text-xs mt-1">Add your first account to start tracking</p>
          </div>
        )
      )}
    </div>
  );
}
