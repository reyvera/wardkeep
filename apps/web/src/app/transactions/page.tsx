'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  type: string;
  accountId: string;
}

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Create form state
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
  if (categoryFilter) params.set('category', categoryFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const txQuery = useQuery({
    queryKey: ['transactions', page, search, accountFilter, categoryFilter, dateFrom, dateTo],
    queryFn: () => apiClient.get<TransactionsResponse>(`/transactions?${params.toString()}`),
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

  const totalPages = txQuery.data ? Math.ceil(txQuery.data.total / txQuery.data.pageSize) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Transaction'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="mb-6 rounded-lg bg-white p-4 shadow-sm space-y-3"
        >
          {createMutation.isError && (
            <p className="text-sm text-red-600">{createMutation.error.message}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input
              placeholder="Merchant"
              value={newTx.merchant}
              onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={newTx.amount}
              onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              type="date"
              value={newTx.date}
              onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <input
              placeholder="Category"
              value={newTx.category}
              onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <select
              value={newTx.type}
              onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
            <input
              placeholder="Account ID"
              value={newTx.accountId}
              onChange={(e) => setNewTx({ ...newTx, accountId: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Transaction'}
          </button>
        </form>
      )}

      {/* Filter bar */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Account ID"
          value={accountFilter}
          onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Category"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {txQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {txQuery.isError && <p className="text-red-600">{txQuery.error.message}</p>}
      {txQuery.data && (
        <>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Merchant</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {txQuery.data.data.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{tx.merchant}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${Math.abs(Number(tx.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">{tx.category}</td>
                    <td className="px-4 py-3 capitalize">{tx.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txQuery.data.data.length === 0 && (
              <p className="p-4 text-gray-500">No transactions found.</p>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
