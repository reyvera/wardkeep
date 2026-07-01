'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface LinkedAccount {
  id: string;
  externalId: string;
  externalName: string;
  externalType: string;
  isEnabled: boolean;
  account: { id: string; name: string; type: string } | null;
}

interface BankConnection {
  id: string;
  provider: string;
  institutionName: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  linkedAccounts: LinkedAccount[];
}

export default function BankConnectionsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [provider, setProvider] = useState<'SIMPLEFIN' | 'PLAID'>('SIMPLEFIN');

  const connectionsQuery = useQuery({
    queryKey: ['bank-connections'],
    queryFn: () => apiClient.get<BankConnection[]>('/bank-connections'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/bank-connections', { provider, institutionName, setupToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
      setShowAddForm(false);
      setInstitutionName('');
      setSetupToken('');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiClient.post<{ imported: number; skippedDuplicates: number }>(
        `/bank-connections/${connectionId}/sync`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiClient.delete(`/bank-connections/${connectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bank Connections</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Connection'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Connect a Bank</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'SIMPLEFIN' | 'PLAID')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="SIMPLEFIN">SimpleFIN</option>
                <option value="PLAID">Plaid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Institution Name
              </label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Chase, Bank of America"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {provider === 'SIMPLEFIN' ? 'Setup Token URL' : 'Access Token'}
              </label>
              <input
                type="text"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder={
                  provider === 'SIMPLEFIN'
                    ? 'https://bridge.simplefin.org/simplefin/setup/...'
                    : 'Plaid access token'
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
                required
              />
              {provider === 'SIMPLEFIN' && (
                <p className="mt-1 text-xs text-gray-500">
                  Get your setup token from{' '}
                  <a
                    href="https://beta-bridge.simplefin.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    SimpleFIN Bridge
                  </a>
                </p>
              )}
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-600">{createMutation.error.message}</p>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </div>
      )}

      {connectionsQuery.isLoading && <p className="text-gray-500">Loading connections...</p>}
      {connectionsQuery.isError && (
        <p className="text-red-600">{connectionsQuery.error.message}</p>
      )}

      {connectionsQuery.data && connectionsQuery.data.length === 0 && !showAddForm && (
        <div className="rounded-lg bg-white p-8 shadow-sm text-center">
          <p className="text-gray-500 mb-2">No bank connections yet.</p>
          <p className="text-sm text-gray-400">
            Connect your bank accounts to automatically import transactions.
          </p>
        </div>
      )}

      {connectionsQuery.data?.map((conn) => (
        <div key={conn.id} className="mb-4 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">{conn.institutionName}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {conn.provider}
                </span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    conn.status === 'ACTIVE'
                      ? 'bg-green-500'
                      : conn.status === 'ERROR'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                  }`}
                />
                <span>{conn.status}</span>
                {conn.lastSyncAt && (
                  <span>· Last sync: {new Date(conn.lastSyncAt).toLocaleString()}</span>
                )}
              </div>
              {conn.lastError && (
                <p className="text-sm text-red-500 mt-1">{conn.lastError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => syncMutation.mutate(conn.id)}
                disabled={syncMutation.isPending}
                className="rounded-md bg-blue-100 px-3 py-1.5 text-blue-700 text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
              >
                Sync
              </button>
              <button
                onClick={() => {
                  if (confirm('Disconnect this bank? Your local accounts and transactions will be kept.')) {
                    removeMutation.mutate(conn.id);
                  }
                }}
                className="rounded-md bg-red-100 px-3 py-1.5 text-red-700 text-sm font-medium hover:bg-red-200"
              >
                Disconnect
              </button>
            </div>
          </div>

          {conn.linkedAccounts.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Linked Accounts</p>
              <ul className="space-y-1">
                {conn.linkedAccounts.map((la) => (
                  <li key={la.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {la.externalName}{' '}
                      <span className="text-gray-400">({la.externalType})</span>
                    </span>
                    {la.account ? (
                      <span className="text-green-600">→ {la.account.name}</span>
                    ) : (
                      <span className="text-amber-600">Not linked</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
