'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, RefreshCw, Trash2, Link2, Landmark, X, CircleDot } from 'lucide-react';

interface LinkedAccount { id: string; externalId: string; externalName: string; externalType: string; isEnabled: boolean; account: { id: string; name: string; type: string } | null; }
interface BankConnection { id: string; provider: string; institutionName: string; status: string; lastSyncAt: string | null; lastError: string | null; linkedAccounts: LinkedAccount[]; }
interface LocalAccount { id: string; name: string; type: string; }

function getStatusColor(status: string): string { switch (status) { case 'ACTIVE': return 'text-accent-green'; case 'ERROR': return 'text-accent-red'; default: return 'text-content-tertiary'; } }

export default function BankConnectionsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [provider, setProvider] = useState<'SIMPLEFIN' | 'PLAID'>('SIMPLEFIN');

  const connectionsQuery = useQuery({ queryKey: ['bank-connections'], queryFn: () => apiClient.get<BankConnection[]>('/bank-connections') });
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => apiClient.get<LocalAccount[]>('/accounts') });

  const createMutation = useMutation({ mutationFn: () => apiClient.post('/bank-connections', { provider, institutionName, setupToken }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bank-connections'] }); setShowAddForm(false); setInstitutionName(''); setSetupToken(''); } });
  const syncMutation = useMutation({ mutationFn: (connectionId: string) => apiClient.post<{ imported: number; skippedDuplicates: number }>(`/bank-connections/${connectionId}/sync`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-connections'] }) });
  const removeMutation = useMutation({ mutationFn: (connectionId: string) => apiClient.delete(`/bank-connections/${connectionId}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-connections'] }) });
  const linkMutation = useMutation({ mutationFn: ({ linkedBankAccountId, accountId }: { linkedBankAccountId: string; accountId: string }) => apiClient.post('/bank-connections/link-account', { linkedBankAccountId, accountId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-connections'] }) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Bank Connections</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className={showAddForm ? 'btn-secondary' : 'btn-primary'}>
          {showAddForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Connection</>}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="card space-y-4">
          <span className="card-title">CONNECT A BANK</span>
          {createMutation.isError && <p className="text-sm text-accent-red">{createMutation.error.message}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="input-label">Provider</label><select value={provider} onChange={(e) => setProvider(e.target.value as 'SIMPLEFIN' | 'PLAID')} className="input"><option value="SIMPLEFIN">SimpleFIN</option><option value="PLAID">Plaid</option></select></div>
            <div><label className="input-label">Institution Name</label><input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="e.g. Chase, Bank of America" className="input" required /></div>
          </div>
          <div>
            <label className="input-label">{provider === 'SIMPLEFIN' ? 'SimpleFIN Token or Access URL' : 'Access Token'}</label>
            <input type="text" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder={provider === 'SIMPLEFIN' ? 'https://demo:demo@beta-bridge.simplefin.org/simplefin' : 'Plaid access token'} className="input font-mono text-xs" required />
            {provider === 'SIMPLEFIN' && <p className="mt-2 text-xs text-content-tertiary">Paste a Base64 setup token or a direct access URL. For demo: <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-xs text-accent-blue">https://demo:demo@beta-bridge.simplefin.org/simplefin</code></p>}
          </div>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">{createMutation.isPending ? 'Connecting...' : 'Connect'}</button>
        </form>
      )}

      {connectionsQuery.isLoading && <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="card space-y-3"><div className="flex items-center gap-4"><div className="skeleton w-10 h-10 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-5 w-40" /><div className="skeleton h-3 w-56" /></div></div></div>)}</div>}
      {connectionsQuery.isError && <div className="card"><p className="text-accent-red text-sm">{connectionsQuery.error.message}</p></div>}

      {connectionsQuery.data && connectionsQuery.data.length === 0 && !showAddForm && (
        <div className="card text-center py-12"><Landmark size={40} className="mx-auto text-content-tertiary mb-3" /><p className="text-content-secondary text-sm">No bank connections yet</p><p className="text-content-tertiary text-xs mt-1">Connect your bank accounts to automatically import transactions</p></div>
      )}

      {connectionsQuery.data?.map((conn) => (
        <div key={conn.id} className="card space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated"><Landmark size={18} className="text-content-secondary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content-primary">{conn.institutionName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono bg-surface-elevated px-2 py-0.5 rounded text-content-tertiary">{conn.provider}</span>
                <CircleDot size={12} className={getStatusColor(conn.status)} />
                <span className={`text-xs ${getStatusColor(conn.status)}`}>{conn.status}</span>
                {conn.lastSyncAt && <span className="text-xs text-content-tertiary">· Last sync: {new Date(conn.lastSyncAt).toLocaleString()}</span>}
              </div>
              {conn.lastError && <p className="text-xs text-accent-red mt-1">{conn.lastError}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => syncMutation.mutate(conn.id)} disabled={syncMutation.isPending} className="btn-ghost p-2 text-content-tertiary hover:text-accent-blue" title="Sync"><RefreshCw size={16} /></button>
              <button onClick={() => { if (confirm('Disconnect this bank?')) removeMutation.mutate(conn.id); }} className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" title="Disconnect"><Trash2 size={16} /></button>
            </div>
          </div>

          {conn.linkedAccounts.length > 0 && (
            <div className="border-t border-edge pt-4">
              <span className="card-title">LINKED ACCOUNTS</span>
              <div className="space-y-2 mt-2">
                {conn.linkedAccounts.map((la) => (
                  <div key={la.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0"><Link2 size={12} className="text-content-tertiary flex-shrink-0" /><span className="text-sm text-content-secondary truncate">{la.externalName}</span><span className="text-xs text-content-tertiary">({la.externalType})</span></div>
                    {la.account ? (
                      <span className="text-xs font-medium text-accent-green whitespace-nowrap">→ {la.account.name}</span>
                    ) : (
                      <select defaultValue="" onChange={(e) => { if (e.target.value) linkMutation.mutate({ linkedBankAccountId: la.id, accountId: e.target.value }); }} className="input w-auto text-xs py-1.5 px-2">
                        <option value="">Link to account...</option>
                        {(accountsQuery.data ?? []).map((acct) => <option key={acct.id} value={acct.id}>{acct.name} ({acct.type})</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
