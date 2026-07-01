'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  isArchived: boolean;
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [balance, setBalance] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/accounts', {
        name,
        type: type.toUpperCase(),
        initialBalance: balance || '0',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setName('');
      setType('checking');
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Account'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-lg bg-white p-4 shadow-sm space-y-3">
          {createMutation.isError && (
            <p className="text-sm text-red-600">{createMutation.error.message}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Account name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit_card">Credit Card</option>
              <option value="loan">Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="cash">Cash</option>
            </select>
            <input
              placeholder="Opening balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Save Account'}
          </button>
        </form>
      )}

      {accountsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {accountsQuery.isError && <p className="text-red-600">{accountsQuery.error.message}</p>}
      {accountsQuery.data && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accountsQuery.data.map((account) => (
                <tr key={account.id} className={account.isArchived ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">{account.name}</td>
                  <td className="px-4 py-3 capitalize">{account.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    ${Number(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    {!account.isArchived && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => archiveMutation.mutate(account.id)}
                          className="text-sm text-gray-600 hover:underline"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Permanently delete this account and all its transactions?')) {
                              deleteMutation.mutate(account.id);
                            }
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {accountsQuery.data.length === 0 && (
            <p className="p-4 text-gray-500">No accounts yet. Create your first account above.</p>
          )}
        </div>
      )}
    </div>
  );
}
