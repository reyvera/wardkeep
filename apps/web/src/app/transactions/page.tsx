'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, Search, ChevronLeft, ChevronRight, X, ArrowLeftRight } from 'lucide-react';
import { CategoryIcon, getCategoryIcon } from '@/components/category-icon';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  categoryId: string | null;
  categoryName?: string;
  type: string;
  accountId: string;
}

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface TransactionsResponse {
  data: Transaction[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hideTransfers, setHideTransfers] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [newTx, setNewTx] = useState({
    merchant: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    type: 'expense',
    accountId: '',
  });

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '20');
  if (search) params.set('search', search);
  if (accountFilter) params.set('accountId', accountFilter);
  if (categoryFilter) params.set('categoryId', categoryFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (hideTransfers) params.set('excludeType', 'TRANSFER');

  const txQuery = useQuery({
    queryKey: ['transactions', page, search, accountFilter, categoryFilter, dateFrom, dateTo, hideTransfers],
    queryFn: () => apiClient.get<TransactionsResponse>(`/transactions?${params.toString()}`),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories'),
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ txId, categoryId }: { txId: string; categoryId: string | null }) =>
      apiClient.patch(`/transactions/${txId}`, { categoryId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const markTransferMutation = useMutation({
    mutationFn: (txId: string) =>
      apiClient.patch(`/transactions/${txId}`, { type: 'TRANSFER' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/transactions', {
        ...newTx,
        amount: parseFloat(newTx.amount) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowForm(false);
      setNewTx({ merchant: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', type: 'expense', accountId: '' });
    },
  });

  const totalPages = txQuery.data?.meta.totalPages ?? 1;
  const totalItems = txQuery.data?.meta.totalItems ?? 0;

  // Category name lookup
  const categoryMap = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-content-primary">Transactions</h1>
          <p className="text-xs text-content-tertiary mt-0.5">{totalItems} total</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={showForm ? 'btn-secondary' : 'btn-primary'}
        >
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add</>}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="card space-y-4">
          {createMutation.isError && (
            <p className="text-sm text-accent-red">{createMutation.error.message}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="input-label">Merchant</label>
              <input placeholder="e.g. Walmart" value={newTx.merchant} onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input placeholder="0.00" type="number" step="0.01" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="input-label">Date</label>
              <input type="date" value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="input-label">Type</label>
              <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })} className="input">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="input-label">Account</label>
              <select value={newTx.accountId} onChange={(e) => setNewTx({ ...newTx, accountId: e.target.value })} className="input">
                <option value="">Select account</option>
                {(accountsQuery.data ?? []).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Category</label>
              <select value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })} className="input">
                <option value="">Uncategorized</option>
                {(categoriesQuery.data ?? []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Saving...' : 'Save Transaction'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="card py-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-8 py-2"
            />
          </div>
          <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }} className="input w-auto py-2">
            <option value="">All Accounts</option>
            {(accountsQuery.data ?? []).map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="input w-auto py-2">
            <option value="">All Categories</option>
            {(categoriesQuery.data ?? []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input w-auto py-2" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input w-auto py-2" />
          <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={hideTransfers} onChange={(e) => { setHideTransfers(e.target.checked); setPage(1); }} className="rounded border-edge" />
            Hide transfers
          </label>
        </div>
      </div>

      {/* Transaction List */}
      {txQuery.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card flex items-center gap-4 py-3">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {txQuery.isError && (
        <div className="card"><p className="text-accent-red text-sm">{txQuery.error.message}</p></div>
      )}

      {txQuery.data && (
        <>
          <div className="space-y-1">
            {txQuery.data.data.map((tx) => {
              const amt = Math.abs(Number(tx.amount));
              const isCredit = tx.type === 'CREDIT';
              const isTransfer = tx.type === 'TRANSFER';
              const catName = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
              const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <div
                  key={tx.id}
                  className="card flex items-center gap-3 py-3 px-4 hover:border-edge-hover transition-colors duration-150"
                >
                  {/* Category Icon */}
                  <CategoryIcon name={catName} size="sm" />

                  {/* Merchant + Category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary truncate">
                      {tx.merchant || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-content-tertiary">{dateStr}</span>
                      {catName && (
                        <span
                          className="category-pill text-[10px]"
                          style={{
                            backgroundColor: `${getCategoryIcon(catName).color}15`,
                            color: getCategoryIcon(catName).color,
                          }}
                        >
                          {catName}
                        </span>
                      )}
                      {isTransfer && (
                        <span className="category-pill text-[10px] bg-content-tertiary/10 text-content-tertiary">
                          Transfer
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-semibold tabular-nums ${isCredit ? 'text-accent-green' : 'text-content-primary'}`}>
                    {isCredit ? '+' : '-'}${formatCurrency(amt)}
                  </span>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 ml-1">
                    <select
                      value={tx.categoryId ?? ''}
                      onChange={(e) => updateCategoryMutation.mutate({ txId: tx.id, categoryId: e.target.value || null })}
                      className="input w-auto py-1 px-1.5 text-[10px] max-w-[80px]"
                      title="Change category"
                    >
                      <option value="">—</option>
                      {(categoriesQuery.data ?? []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    {!isTransfer && (
                      <button
                        onClick={() => markTransferMutation.mutate(tx.id)}
                        className="btn-ghost p-1 text-content-tertiary hover:text-accent-blue"
                        title="Mark as transfer"
                      >
                        <ArrowLeftRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {txQuery.data.data.length === 0 && (
              <div className="card text-center py-12">
                <ArrowLeftRight size={40} className="mx-auto text-content-tertiary mb-3" />
                <p className="text-content-secondary text-sm">No transactions found</p>
                <p className="text-content-tertiary text-xs mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-content-tertiary">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
