'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Plus,
  Archive,
  Trash2,
  Wallet,
  CreditCard,
  Landmark,
  PiggyBank,
  Banknote,
  X,
  Home,
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: string;
  creditLimit: string | null;
  isArchived: boolean;
  source: 'synchronized' | 'manual';
  lastUpdatedAt: string;
  freshness: 'current' | 'stale';
}

interface DebtProfile {
  id: string;
  accountId: string;
  assetValue: string | null;
}

interface RealEstateProfile {
  id: string;
  accountId: string;
  mortgageAccountId: string | null;
  recordedValue: string;
  valuationDate: string;
  mortgageBalance: string;
  equity: string;
  limitation: string;
}

function getAccountIcon(type: string) {
  switch (type) {
    case 'CREDIT_CARD':
      return CreditCard;
    case 'LOAN':
    case 'MORTGAGE':
      return Landmark;
    case 'SAVINGS':
      return PiggyBank;
    case 'CASH':
      return Banknote;
    default:
      return Wallet;
  }
}

function formatAccountType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isStaleValuation(date: string): boolean {
  const valuationDate = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Date.now() - valuationDate.getTime() > 180 * 24 * 60 * 60 * 1000;
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [assetValueInput, setAssetValueInput] = useState('');
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [propertyValue, setPropertyValue] = useState('');
  const [propertyDate, setPropertyDate] = useState('');
  const [propertyMortgageId, setPropertyMortgageId] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });

  const profilesQuery = useQuery({
    queryKey: ['debt-profiles'],
    queryFn: () => apiClient.get<DebtProfile[]>('/debt/profiles'),
  });

  const realEstateQuery = useQuery({
    queryKey: ['real-estate-profiles'],
    queryFn: () => apiClient.get<RealEstateProfile[]>('/real-estate'),
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({ profileId, assetValue }: { profileId: string; assetValue: string | null }) =>
      apiClient.patch(`/debt/profiles/${profileId}`, { assetValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      setEditingAsset(null);
      setAssetValueInput('');
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: ({ accountId, recordedValue, valuationDate, mortgageAccountId }: {
      accountId: string; recordedValue: string; valuationDate: string; mortgageAccountId: string | null;
    }) => apiClient.put(`/real-estate/${accountId}`, { recordedValue, valuationDate, mortgageAccountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['real-estate-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      setEditingProperty(null);
      setPropertyValue('');
      setPropertyDate('');
      setPropertyMortgageId('');
    },
  });

  const removePropertyMutation = useMutation({
    mutationFn: (accountId: string) => apiClient.delete(`/real-estate/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['real-estate-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/accounts', {
        name,
        type,
        initialBalance: balance || '0',
        ...(type === 'CREDIT_CARD' && creditLimit ? { creditLimit } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setName('');
      setType('CHECKING');
      setBalance('');
      setCreditLimit('');
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
  const profiles = profilesQuery.data ?? [];
  const realEstateProfiles = realEstateQuery.data ?? [];
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const debtTypes = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC'];
  const totalAssets = activeAccounts
    .filter((a) => !debtTypes.includes(a.type) && a.type !== 'REAL_ESTATE')
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const totalLiabilities = activeAccounts
    .filter((a) => debtTypes.includes(a.type))
    .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance)), 0);
  const totalAssetValues = profiles.reduce(
    (sum, p) => sum + (p.assetValue ? Number(p.assetValue) : 0),
    0,
  ) + realEstateProfiles.reduce((sum, profile) => sum + Number(profile.recordedValue), 0);
  const totalBalance = totalAssets + totalAssetValues - totalLiabilities;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Accounts</h1>
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
              <Plus size={16} /> Add Account
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <span className="card-title">NET WORTH</span>
          <p
            className={`text-2xl font-bold tabular-nums ${totalBalance >= 0 ? 'text-content-primary' : 'text-accent-red'}`}
          >
            ${formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="card">
          <span className="card-title">ASSETS</span>
          <p className="text-2xl font-bold tabular-nums text-accent-green">
            ${formatCurrency(totalAssets + totalAssetValues)}
          </p>
          {totalAssetValues > 0 && (
            <p className="text-xs text-content-tertiary mt-1">
              Includes ${formatCurrency(totalAssetValues)} in recorded property/vehicle value
            </p>
          )}
        </div>
        <div className="card">
          <span className="card-title">LIABILITIES</span>
          <p className="text-2xl font-bold tabular-nums text-accent-red">
            ${formatCurrency(totalLiabilities)}
          </p>
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
            {type === 'CREDIT_CARD' && (
              <div>
                <label className="input-label">Credit Limit</label>
                <input
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="input"
                />
              </div>
            )}
            <div>
              <label className="input-label">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="LOAN">Loan</option>
                <option value="MORTGAGE">Mortgage</option>
                <option value="REAL_ESTATE">Real Estate</option>
                <option value="BROKERAGE">Brokerage</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="CRYPTO">Crypto</option>
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
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
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
            const profile = isDebt ? profiles.find((p) => p.accountId === account.id) : null;
            const isEditingThis = editingAsset === account.id;
            const propertyProfile = account.type === 'REAL_ESTATE'
              ? realEstateProfiles.find((item) => item.accountId === account.id)
              : null;
            const isEditingProperty = editingProperty === account.id;

            return (
              <div
                key={account.id}
                className="card flex flex-col gap-2 py-4 hover:border-edge-hover transition-colors duration-150"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated">
                    <Icon size={18} className="text-content-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-content-tertiary">
                      {formatAccountType(account.type)} ·{' '}
                      {account.source === 'synchronized' ? 'Synced' : 'Manual'}
                      {account.freshness === 'stale' ? ' · may be outdated' : ''}
                    </p>
                    {account.type === 'CREDIT_CARD' && account.creditLimit && (
                      <p className="text-xs text-content-tertiary">
                        Available credit: $
                        {formatCurrency(Math.max(0, Number(account.creditLimit) - Math.abs(bal)))} ·
                        Borrowing capacity, not cash
                      </p>
                    )}
                  </div>
                  <p
                    className={`text-base font-bold tabular-nums ${isDebt ? 'text-accent-red' : 'text-content-primary'}`}
                  >
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

                {/* Asset value for secured debt accounts */}
                {isDebt && profile && (
                  <div className="ml-14 flex items-center gap-2">
                    {isEditingThis ? (
                      <>
                        <Home size={12} className="text-content-tertiary" />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Asset value (e.g. home worth)"
                          value={assetValueInput}
                          onChange={(e) => setAssetValueInput(e.target.value)}
                          className="input text-xs py-1 w-40"
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            updateAssetMutation.mutate({
                              profileId: profile.id,
                              assetValue: assetValueInput || null,
                            })
                          }
                          disabled={updateAssetMutation.isPending}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingAsset(null);
                            setAssetValueInput('');
                          }}
                          className="btn-ghost text-xs px-2 py-1"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <Home size={12} className="text-content-tertiary" />
                        {profile.assetValue ? (
                          <span className="text-xs text-content-secondary">
                            Asset value:{' '}
                            <span className="text-accent-green font-medium">
                              ${formatCurrency(Number(profile.assetValue))}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-content-tertiary">No asset value set</span>
                        )}
                        <button
                          onClick={() => {
                            setEditingAsset(account.id);
                            setAssetValueInput(profile.assetValue ?? '');
                          }}
                          className="text-xs text-accent-blue hover:underline ml-1"
                        >
                          {profile.assetValue ? 'edit' : 'set value'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {account.type === 'REAL_ESTATE' && (
                  <div className="ml-14 space-y-2 text-xs">
                    {realEstateQuery.isError && (
                      <p className="text-accent-red">Property details could not be loaded. Try refreshing before changing this record.</p>
                    )}
                    {isEditingProperty ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-content-tertiary">
                          Value
                          <input type="number" min="0" step="0.01" value={propertyValue}
                            onChange={(e) => setPropertyValue(e.target.value)} className="input mt-1 py-1 w-32" />
                        </label>
                        <label className="text-content-tertiary">
                          As of
                          <input type="date" value={propertyDate}
                            onChange={(e) => setPropertyDate(e.target.value)} className="input mt-1 py-1" />
                        </label>
                        <label className="text-content-tertiary">
                          Mortgage
                          <select value={propertyMortgageId} onChange={(e) => setPropertyMortgageId(e.target.value)} className="input mt-1 py-1">
                            <option value="">No linked mortgage</option>
                            {activeAccounts.filter((item) => item.type === 'MORTGAGE').map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>
                        <button onClick={() => updatePropertyMutation.mutate({ accountId: account.id, recordedValue: propertyValue, valuationDate: propertyDate, mortgageAccountId: propertyMortgageId || null })}
                          disabled={!propertyValue || !propertyDate || updatePropertyMutation.isPending} className="btn-primary text-xs px-2 py-1">Save</button>
                        <button onClick={() => setEditingProperty(null)} className="btn-ghost text-xs px-2 py-1">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Home size={12} className="text-content-tertiary" />
                        <span className="text-content-secondary">
                          {propertyProfile
                            ? `Value: $${formatCurrency(Number(propertyProfile.recordedValue))} · Equity: $${formatCurrency(Number(propertyProfile.equity))}`
                            : 'Add the property value to include it in readiness.'}
                        </span>
                        <button onClick={() => {
                          setEditingProperty(account.id);
                          setPropertyValue(propertyProfile?.recordedValue ?? '');
                          setPropertyDate(propertyProfile?.valuationDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
                          setPropertyMortgageId(propertyProfile?.mortgageAccountId ?? '');
                        }} className="text-xs text-accent-blue hover:underline">
                          {propertyProfile ? 'edit' : 'set value'}
                        </button>
                        {propertyProfile && (
                          <button onClick={() => {
                            if (confirm(`Remove the recorded valuation for ${account.name}? The account and mortgage will remain.`)) {
                              removePropertyMutation.mutate(account.id);
                            }
                          }} disabled={removePropertyMutation.isPending} className="text-xs text-accent-red hover:underline">
                            remove valuation
                          </button>
                        )}
                      </div>
                    )}
                    {propertyProfile && (
                      <p className={isStaleValuation(propertyProfile.valuationDate) ? 'text-accent-yellow' : 'text-content-tertiary'}>
                        Mortgage: ${formatCurrency(Number(propertyProfile.mortgageBalance))} · Valued {new Date(`${propertyProfile.valuationDate.slice(0, 10)}T00:00:00`).toLocaleDateString()}{isStaleValuation(propertyProfile.valuationDate) ? ' · review valuation freshness' : ''} · {propertyProfile.limitation}
                      </p>
                    )}
                    {(updatePropertyMutation.isError || removePropertyMutation.isError) && (
                      <p className="text-accent-red">
                        {updatePropertyMutation.isError
                          ? updatePropertyMutation.error.message
                          : removePropertyMutation.error?.message ?? 'Property valuation could not be removed.'}
                      </p>
                    )}
                  </div>
                )}
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
                {accounts
                  .filter((a) => a.isArchived)
                  .map((account) => {
                    const Icon = getAccountIcon(account.type);
                    return (
                      <div key={account.id} className="card flex items-center gap-4 py-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated">
                          <Icon size={18} className="text-content-tertiary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-content-secondary">{account.name}</p>
                          <p className="text-xs text-content-tertiary">
                            {formatAccountType(account.type)}
                          </p>
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
            <p className="text-content-tertiary text-xs mt-1">
              Add your first account to start tracking
            </p>
          </div>
        )
      )}
    </div>
  );
}
