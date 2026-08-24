'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ArrowLeftRight,
  Clock,
  Zap,
  CircleOff,
  Check,
  Tag,
} from 'lucide-react';
import { CategoryIcon, getCategoryIcon } from '@/components/category-icon';
import { CreateRuleModal } from '@/components/create-rule-modal';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  categoryId: string | null;
  categoryName?: string;
  type: string;
  status?: string;
  accountId: string;
  isReviewed?: boolean;
  tags?: Array<{ tag: string }>;
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

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [hideTransfers, setHideTransfers] = useState(true);
  const [showNeedsReview, setShowNeedsReview] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [ruleTransaction, setRuleTransaction] = useState<Transaction | null>(null);
  const [selectedForReview, setSelectedForReview] = useState<string[]>([]);
  const [tagEditor, setTagEditor] = useState<{ transactionId: string; value: string } | null>(null);

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
  if (tagFilter) params.set('tag', tagFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (hideTransfers) params.set('excludeType', 'TRANSFER');
  params.set('reviewed', 'true');

  const txQuery = useQuery({
    queryKey: [
      'transactions',
      page,
      search,
      accountFilter,
      categoryFilter,
      tagFilter,
      dateFrom,
      dateTo,
      hideTransfers,
      'reviewed',
    ],
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

  const unreviewedQuery = useQuery({
    queryKey: ['transactions', 'review-inbox'],
    queryFn: () => apiClient.get<TransactionsResponse>('/transactions?reviewed=false&pageSize=200'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ txId, categoryId }: { txId: string; categoryId: string | null }) =>
      apiClient.patch(`/transactions/${txId}`, { categoryId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const markTransferMutation = useMutation({
    mutationFn: (txId: string) => apiClient.patch(`/transactions/${txId}`, { type: 'TRANSFER' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const toggleOneTimeMutation = useMutation({
    mutationFn: ({ txId, tags }: { txId: string; tags: string[] }) =>
      apiClient.patch(`/transactions/${txId}`, { tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const markReviewedMutation = useMutation({
    mutationFn: (txId: string) => apiClient.patch(`/transactions/${txId}/review`, {}),
    onSuccess: (_result, txId) => {
      setSelectedForReview((selected) => selected.filter((id) => id !== txId));
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const markVisibleReviewedMutation = useMutation({
    mutationFn: (transactionIds: string[]) =>
      Promise.all(
        transactionIds.map((txId) => apiClient.patch(`/transactions/${txId}/review`, {})),
      ),
    onSuccess: () => {
      setSelectedForReview([]);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
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
      setNewTx({
        merchant: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        type: 'expense',
        accountId: '',
      });
    },
  });

  const totalPages = txQuery.data?.meta.totalPages ?? 1;
  const totalItems = txQuery.data?.meta.totalItems ?? 0;

  // Category name lookup
  const categoryMap = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title text-content-primary">Transactions</h1>
          <p className="text-xs text-content-tertiary mt-0.5">{totalItems} reviewed</p>
        </div>
        <div className="flex items-center gap-2">
          {showNeedsReview && (unreviewedQuery.data?.data.length ?? 0) > 0 && (
            <>
              <button
                onClick={() =>
                  setSelectedForReview((selected) =>
                    selected.length === unreviewedQuery.data!.data.length
                      ? []
                      : unreviewedQuery.data!.data.map((tx) => tx.id),
                  )
                }
                className="btn-secondary"
              >
                {selectedForReview.length === (unreviewedQuery.data?.data.length ?? 0)
                  ? 'Clear selection'
                  : 'Select all'}
              </button>
              {selectedForReview.length > 0 && (
                <button
                  onClick={() => markVisibleReviewedMutation.mutate(selectedForReview)}
                  disabled={markVisibleReviewedMutation.isPending}
                  className="btn-secondary"
                >
                  <Check size={16} />
                  {markVisibleReviewedMutation.isPending
                    ? 'Reviewing...'
                    : `Mark ${selectedForReview.length} reviewed`}
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? 'btn-secondary' : 'btn-primary'}
          >
            {showForm ? (
              <>
                <X size={16} /> Cancel
              </>
            ) : (
              <>
                <Plus size={16} /> Add
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="card space-y-4"
        >
          {createMutation.isError && (
            <p className="text-sm text-accent-red">{createMutation.error.message}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="input-label">Merchant</label>
              <input
                placeholder="e.g. Walmart"
                value={newTx.merchant}
                onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="input-label">Date</label>
              <input
                type="date"
                value={newTx.date}
                onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Type</label>
              <select
                value={newTx.type}
                onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                className="input"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="input-label">Account</label>
              <select
                value={newTx.accountId}
                onChange={(e) => setNewTx({ ...newTx, accountId: e.target.value })}
                className="input"
              >
                <option value="">Select account</option>
                {(accountsQuery.data ?? []).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Category</label>
              <select
                value={newTx.category}
                onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                className="input"
              >
                <option value="">Uncategorized</option>
                {(categoriesQuery.data ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
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
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
            />
            <input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-8 py-2"
            />
          </div>
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className="input w-auto py-2"
          >
            <option value="">All Accounts</option>
            {(accountsQuery.data ?? []).map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Filter by tag"
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            className="input w-36 py-2"
          />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="input w-auto py-2"
          >
            <option value="">All Categories</option>
            <option value="NONE">Uncategorized</option>
            {(categoriesQuery.data ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="input w-auto py-2"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="input w-auto py-2"
          />
          <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideTransfers}
              onChange={(e) => {
                setHideTransfers(e.target.checked);
                setPage(1);
              }}
              className="rounded border-edge"
            />
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
        <div className="card">
          <p className="text-accent-red text-sm">{txQuery.error.message}</p>
        </div>
      )}

      {txQuery.data && (
        <>
          <section className="card space-y-3">
            <button
              type="button"
              onClick={() => {
                setShowNeedsReview((show) => !show);
                if (showNeedsReview) setSelectedForReview([]);
              }}
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-content-primary"
              aria-expanded={showNeedsReview}
            >
              <ChevronDown
                size={16}
                className={`text-content-tertiary transition-transform ${showNeedsReview ? '' : '-rotate-90'}`}
              />
              Needs review
              {(unreviewedQuery.data?.meta.totalItems ?? 0) > 0 && (
                <span className="rounded-full bg-accent-blue/10 px-2 py-0.5 text-xs text-accent-blue">
                  {unreviewedQuery.data!.meta.totalItems}
                </span>
              )}
            </button>

            {showNeedsReview && unreviewedQuery.isLoading && (
              <p className="text-sm text-content-tertiary">
                Loading transactions that need review…
              </p>
            )}

            {showNeedsReview &&
              (unreviewedQuery.data?.data.length ?? 0) === 0 &&
              !unreviewedQuery.isLoading && (
                <p className="text-sm text-content-tertiary">Everything is reviewed.</p>
              )}

            {showNeedsReview && (unreviewedQuery.data?.data.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-content-tertiary">
                  Verify the merchant, date, and amount. Categorize it or mark a transfer, one-time
                  expense, or tag before marking it reviewed.
                </p>
                {unreviewedQuery.data!.data.map((tx) => {
                  const amt = Math.abs(Number(tx.amount));
                  const isCredit = tx.type === 'CREDIT';
                  const isSelectedForReview = selectedForReview.includes(tx.id);
                  const catName = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                  const isOneTime =
                    tx.tags?.some((tag) => tag.tag.toLowerCase() === 'one-time') ?? false;
                  const dateStr = new Date(tx.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border border-edge px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={isSelectedForReview}
                        onChange={() =>
                          setSelectedForReview((selected) =>
                            isSelectedForReview
                              ? selected.filter((id) => id !== tx.id)
                              : [...selected, tx.id],
                          )
                        }
                        className="h-4 w-4 shrink-0 rounded border-edge accent-accent-blue"
                        aria-label={`Select ${tx.merchant || 'transaction'} for review`}
                      />
                      <CategoryIcon name={catName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content-primary">
                          {tx.merchant || 'Unknown'}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[10px] text-content-tertiary">{dateStr}</span>
                          <span className="category-pill bg-accent-blue/10 text-[10px] text-accent-blue">
                            Needs review
                          </span>
                        </div>
                      </div>
                      <span
                        className={`w-20 shrink-0 text-right text-sm font-semibold tabular-nums ${isCredit ? 'text-accent-green' : 'text-content-primary'}`}
                      >
                        {isCredit ? '+' : '-'}${formatCurrency(amt)}
                      </span>
                      <div className="col-span-4 flex flex-wrap items-center justify-end gap-1 border-t border-edge pt-2">
                        <select
                          value={tx.categoryId ?? ''}
                          onChange={(e) =>
                            updateCategoryMutation.mutate({
                              txId: tx.id,
                              categoryId: e.target.value || null,
                            })
                          }
                          className="input w-auto max-w-[100px] py-1 px-1.5 text-[10px]"
                          title="Set category"
                        >
                          <option value="">Uncategorized</option>
                          {(categoriesQuery.data ?? []).map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        {tx.type === 'DEBIT' && (
                          <button
                            onClick={() => markTransferMutation.mutate(tx.id)}
                            className="btn-ghost p-1 text-content-tertiary hover:text-accent-blue"
                            title="Mark as transfer"
                          >
                            <ArrowLeftRight size={13} />
                          </button>
                        )}
                        {tx.type === 'DEBIT' && (
                          <button
                            onClick={() => {
                              const tags = (tx.tags ?? []).map((tag) => tag.tag);
                              toggleOneTimeMutation.mutate({
                                txId: tx.id,
                                tags: isOneTime
                                  ? tags.filter((tag) => tag.toLowerCase() !== 'one-time')
                                  : [...tags, 'one-time'],
                              });
                            }}
                            className={`btn-ghost p-1 ${isOneTime ? 'text-accent-purple' : 'text-content-tertiary hover:text-accent-purple'}`}
                            title={
                              isOneTime ? 'Include in readiness burn rate' : 'Mark as one-time'
                            }
                          >
                            <CircleOff size={13} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setTagEditor({
                              transactionId: tx.id,
                              value: (tx.tags ?? []).map((tag) => tag.tag).join(', '),
                            })
                          }
                          className="btn-ghost p-1 text-content-tertiary hover:text-accent-purple"
                          title="Edit tags"
                        >
                          <Tag size={13} />
                        </button>
                        <button
                          onClick={() => markReviewedMutation.mutate(tx.id)}
                          disabled={markReviewedMutation.isPending}
                          className="btn-secondary whitespace-nowrap py-1 px-2 text-[10px]"
                        >
                          <Check size={13} /> Mark reviewed
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <h2 className="text-section text-content-primary">Reviewed transactions</h2>
          <div className="space-y-1">
            {txQuery.data.data.map((tx) => {
              const amt = Math.abs(Number(tx.amount));
              const isCredit = tx.type === 'CREDIT';
              const isTransfer = tx.type === 'TRANSFER';
              const isPending = tx.status === 'PENDING';
              const isOneTime =
                tx.tags?.some((tag) => tag.tag.toLowerCase() === 'one-time') ?? false;
              const otherTags = (tx.tags ?? []).filter(
                (tag) => tag.tag.toLowerCase() !== 'one-time',
              );
              const catName = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
              const dateStr = new Date(tx.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={tx.id}
                  className={`card flex items-center gap-3 py-3 px-4 hover:border-edge-hover transition-colors duration-150 ${isPending ? 'opacity-70' : ''}`}
                >
                  {/* Pending indicator */}
                  {isPending && (
                    <div
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent-yellow"
                      title="Pending"
                    />
                  )}

                  {/* Category Icon */}
                  <CategoryIcon name={catName} size="sm" />

                  {/* Merchant + Category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary truncate">
                      {tx.merchant || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-content-tertiary">{dateStr}</span>
                      {isPending && (
                        <span className="category-pill text-[10px] bg-accent-yellow/10 text-accent-yellow">
                          <Clock size={8} className="inline mr-0.5" />
                          Pending
                        </span>
                      )}
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
                      {isOneTime && (
                        <span className="category-pill text-[10px] bg-accent-purple/10 text-accent-purple">
                          One-time
                        </span>
                      )}
                      {otherTags.map((tag) => (
                        <span
                          key={tag.tag}
                          className="category-pill bg-accent-purple/10 text-[10px] text-accent-purple"
                        >
                          {tag.tag}
                        </span>
                      ))}
                      {tagEditor?.transactionId === tx.id && (
                        <div className="flex w-full items-center gap-1.5 pt-1">
                          <input
                            autoFocus
                            value={tagEditor.value}
                            onChange={(e) =>
                              setTagEditor({ transactionId: tx.id, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                toggleOneTimeMutation.mutate({
                                  txId: tx.id,
                                  tags: parseTags(tagEditor.value),
                                });
                                setTagEditor(null);
                              }
                              if (e.key === 'Escape') setTagEditor(null);
                            }}
                            placeholder="Tags, separated by commas"
                            className="input h-7 min-w-0 flex-1 py-1 text-xs"
                          />
                          <button
                            onClick={() => {
                              toggleOneTimeMutation.mutate({
                                txId: tx.id,
                                tags: parseTags(tagEditor.value),
                              });
                              setTagEditor(null);
                            }}
                            className="btn-ghost p-1 text-accent-green"
                            title="Save tags"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setTagEditor(null)}
                            className="btn-ghost p-1 text-content-tertiary"
                            title="Cancel tag editing"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span
                    className={`text-sm font-semibold tabular-nums ${isCredit ? 'text-accent-green' : 'text-content-primary'}`}
                  >
                    {isCredit ? '+' : '-'}${formatCurrency(amt)}
                  </span>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 ml-1">
                    <select
                      value={tx.categoryId ?? ''}
                      onChange={(e) =>
                        updateCategoryMutation.mutate({
                          txId: tx.id,
                          categoryId: e.target.value || null,
                        })
                      }
                      className="input w-auto py-1 px-1.5 text-[10px] max-w-[80px]"
                      title="Change category"
                    >
                      <option value="">—</option>
                      {(categoriesQuery.data ?? []).map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
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
                    {tx.type === 'DEBIT' && (
                      <button
                        onClick={() => {
                          const tags = (tx.tags ?? []).map((tag) => tag.tag);
                          toggleOneTimeMutation.mutate({
                            txId: tx.id,
                            tags: isOneTime
                              ? tags.filter((tag) => tag.toLowerCase() !== 'one-time')
                              : [...tags, 'one-time'],
                          });
                        }}
                        className={`btn-ghost p-1 ${isOneTime ? 'text-accent-purple' : 'text-content-tertiary hover:text-accent-purple'}`}
                        title={
                          isOneTime
                            ? 'Include in readiness burn rate'
                            : 'Mark as one-time for readiness'
                        }
                      >
                        <CircleOff size={12} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setTagEditor({
                          transactionId: tx.id,
                          value: (tx.tags ?? []).map((tag) => tag.tag).join(', '),
                        })
                      }
                      className="btn-ghost p-1 text-content-tertiary hover:text-accent-purple"
                      title="Edit tags"
                    >
                      <Tag size={12} />
                    </button>
                    <button
                      onClick={() => setRuleTransaction(tx)}
                      className="btn-ghost p-1 text-content-tertiary hover:text-accent-purple"
                      title="Create rule from this transaction"
                    >
                      <Zap size={12} />
                    </button>
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
      {/* Create Rule Modal */}
      {ruleTransaction && categoriesQuery.data && (
        <CreateRuleModal
          transaction={ruleTransaction}
          categories={categoriesQuery.data}
          onClose={() => setRuleTransaction(null)}
        />
      )}
    </div>
  );
}
