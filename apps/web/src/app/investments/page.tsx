'use client';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
type Holding = {
  id: string;
  symbol: string;
  quantity: string;
  costBasis: string | null;
  quotePrice: string | null;
  quoteSource: string | null;
  quoteAsOf: string | null;
  account: { name: string; type: string; currency: string };
  quoteSnapshots: Array<{ price: string; source: string; asOf: string }>;
};
type Account = { id: string; name: string; type: string; isArchived: boolean };

function isStaleQuote(quoteAsOf: string | null): boolean {
  if (!quoteAsOf) return false;
  const asOf = new Date(`${quoteAsOf.slice(0, 10)}T00:00:00`);
  return Date.now() - asOf.getTime() > 7 * 24 * 60 * 60 * 1000;
}

export default function InvestmentsPage() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteSource, setQuoteSource] = useState('Manual entry');
  const [quoteAsOf, setQuoteAsOf] = useState('');
  const [editingHolding, setEditingHolding] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editCostBasis, setEditCostBasis] = useState('');
  const holdings = useQuery({
    queryKey: ['investments'],
    queryFn: () => apiClient.get<Holding[]>('/investments'),
  });
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });
  const eligibleAccounts = (accounts.data ?? []).filter(
    (account) => !account.isArchived && ['BROKERAGE', 'RETIREMENT', 'CRYPTO'].includes(account.type),
  );
  const createHolding = useMutation({
    mutationFn: () => apiClient.post('/investments', {
      accountId,
      symbol,
      quantity,
      ...(costBasis ? { costBasis } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setSymbol('');
      setQuantity('');
      setCostBasis('');
    },
  });
  const removeHolding = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/investments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investments'] }),
  });
  const recordQuote = useMutation({
    mutationFn: ({ id, price, source, asOf }: { id: string; price: string; source: string; asOf: string }) =>
      apiClient.patch(`/investments/${id}/quote`, { quotePrice: price, quoteSource: source, quoteAsOf: asOf }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setEditingQuote(null);
      setQuotePrice('');
      setQuoteSource('Manual entry');
      setQuoteAsOf('');
    },
  });
  const updateHolding = useMutation({
    mutationFn: ({ id, quantity: nextQuantity, costBasis: nextCostBasis }: { id: string; quantity: string; costBasis: string | null }) =>
      apiClient.patch(`/investments/${id}`, { quantity: nextQuantity, costBasis: nextCostBasis }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setEditingHolding(null);
      setEditQuantity('');
      setEditCostBasis('');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    createHolding.mutate();
  };
  const quotedHoldings = (holdings.data ?? []).filter((holding) => holding.quotePrice !== null);
  const quotedValue = quotedHoldings.reduce(
    (total, holding) => total + Number(holding.quotePrice) * Number(holding.quantity), 0,
  );
  const costBasisHoldings = (holdings.data ?? []).filter((holding) => holding.costBasis !== null);
  const recordedCostBasis = costBasisHoldings.reduce(
    (total, holding) => total + Number(holding.costBasis), 0,
  );
  const comparableHoldings = quotedHoldings.filter((holding) => holding.costBasis !== null);
  const quotedComparableValue = comparableHoldings.reduce(
    (total, holding) => total + Number(holding.quotePrice) * Number(holding.quantity), 0,
  );
  const comparableCostBasis = comparableHoldings.reduce(
    (total, holding) => total + Number(holding.costBasis), 0,
  );
  const allocation = Object.entries(
    quotedHoldings.reduce<Record<string, number>>((totals, holding) => {
      totals[holding.symbol] = (totals[holding.symbol] ?? 0) + Number(holding.quotePrice) * Number(holding.quantity);
      return totals;
    }, {}),
  )
    .map(([symbol, value]) => ({ symbol, value, percent: quotedValue > 0 ? (value / quotedValue) * 100 : 0 }))
    .sort((left, right) => right.value - left.value);
  const staleQuoteCount = quotedHoldings.filter((holding) => isStaleQuote(holding.quoteAsOf)).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Investments</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Recorded holdings and factual quote snapshots only. Wardkeep does not provide investment
          advice.
        </p>
      </div>
      {holdings.data && holdings.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card">
            <span className="card-title">RECORDED QUOTED VALUE</span>
            <p className="text-2xl font-bold tabular-nums text-content-primary">${quotedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-content-tertiary">
              Based on {quotedHoldings.length} of {holdings.data.length} holding{holdings.data.length === 1 ? '' : 's'} with a dated quote. This is not live market data.
            </p>
            {staleQuoteCount > 0 && <p className="mt-1 text-xs text-accent-yellow">{staleQuoteCount} recorded quote{staleQuoteCount === 1 ? ' is' : 's are'} over 7 days old; review before relying on this total.</p>}
          </div>
          <div className="card">
            <span className="card-title">RECORDED COST BASIS</span>
            <p className="text-2xl font-bold tabular-nums text-content-primary">${recordedCostBasis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-content-tertiary">
              Recorded for {costBasisHoldings.length} of {holdings.data.length} holding{holdings.data.length === 1 ? '' : 's'}.
            </p>
            {comparableHoldings.length > 0 && (
              <p className="mt-1 text-xs text-content-secondary">
                Quote difference: {(quotedComparableValue - comparableCostBasis) >= 0 ? '+' : ''}${(quotedComparableValue - comparableCostBasis).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across {comparableHoldings.length} comparably recorded holding{comparableHoldings.length === 1 ? '' : 's'}.
              </p>
            )}
          </div>
          <div className="card">
            <span className="card-title">MEASURED ALLOCATION</span>
            {allocation.length > 0 ? (
              <div className="mt-2 space-y-2">
                {allocation.map((item) => (
                  <div key={item.symbol}>
                    <div className="flex justify-between text-xs text-content-secondary"><span>{item.symbol}</span><span>{item.percent.toFixed(1)}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-elevated"><div className="h-full rounded bg-accent-blue" style={{ width: `${item.percent}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-xs text-content-tertiary">Record a dated quote to measure allocation.</p>}
          </div>
        </div>
      )}
      <form onSubmit={submit} className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="input-label flex-1 min-w-44">Investment account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="input mt-1" required>
              <option value="">Select account</option>
              {eligibleAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} · {account.type.toLowerCase()}</option>
              ))}
            </select>
          </label>
          <label className="input-label">Symbol or asset
            <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="input mt-1 w-32" placeholder="e.g. VTI" maxLength={32} required />
          </label>
          <label className="input-label">Quantity
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="any" className="input mt-1 w-28" required />
          </label>
          <label className="input-label">Total cost basis <span className="normal-case">(optional)</span>
            <input value={costBasis} onChange={(event) => setCostBasis(event.target.value)} type="number" min="0" step="0.01" className="input mt-1 w-36" />
          </label>
          <button type="submit" disabled={!accountId || createHolding.isPending} className="btn-primary">
            {createHolding.isPending ? 'Adding…' : 'Add holding'}
          </button>
        </div>
        {eligibleAccounts.length === 0 && !accounts.isLoading && (
          <p className="text-xs text-content-tertiary">Create a brokerage, retirement, or crypto account in Accounts before adding holdings.</p>
        )}
        {createHolding.isError && <p className="text-sm text-accent-red">{createHolding.error.message}</p>}
      </form>
      {holdings.isLoading ? (
        <div className="card skeleton h-32" />
      ) : holdings.data?.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-content-tertiary">
              <tr>
                <th>Holding</th>
                <th>Account</th>
                <th>Quantity</th>
                <th>Cost basis</th>
                <th>Quote</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {holdings.data.map((holding) => (
                <tr key={holding.id} className="border-t border-edge">
                  <td className="py-3 font-medium">{holding.symbol}</td>
                  <td>{holding.account.name}</td>
                  <td>{editingHolding === holding.id ? <input type="number" min="0" step="any" value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} className="input w-24 py-1 text-xs" /> : holding.quantity}</td>
                  <td>{editingHolding === holding.id ? <input type="number" min="0" step="0.01" value={editCostBasis} onChange={(event) => setEditCostBasis(event.target.value)} className="input w-28 py-1 text-xs" placeholder="Not recorded" /> : (holding.costBasis ?? 'Not recorded')}</td>
                  <td>
                    {editingQuote === holding.id ? (
                      <div className="flex min-w-72 flex-wrap gap-1">
                        <input type="number" min="0" step="any" value={quotePrice} onChange={(event) => setQuotePrice(event.target.value)} className="input w-20 py-1 text-xs" placeholder="Price" />
                        <input value={quoteSource} onChange={(event) => setQuoteSource(event.target.value)} className="input w-24 py-1 text-xs" placeholder="Source" maxLength={80} />
                        <input type="date" value={quoteAsOf} onChange={(event) => setQuoteAsOf(event.target.value)} className="input py-1 text-xs" />
                        <button onClick={() => recordQuote.mutate({ id: holding.id, price: quotePrice, source: quoteSource, asOf: quoteAsOf })} disabled={!quotePrice || !quoteAsOf || recordQuote.isPending} className="text-xs text-accent-blue hover:underline">Save</button>
                        <button onClick={() => setEditingQuote(null)} className="text-xs text-content-tertiary hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div>
                        <span>{holding.quotePrice ? `${holding.quotePrice} · ${holding.quoteSource ?? 'source unknown'}` : 'No quote yet'}</span>
                        {holding.quoteAsOf && <p className={`text-xs ${isStaleQuote(holding.quoteAsOf) ? 'text-accent-yellow' : 'text-content-tertiary'}`}>As of {new Date(`${holding.quoteAsOf.slice(0, 10)}T00:00:00`).toLocaleDateString()}{isStaleQuote(holding.quoteAsOf) ? ' · review freshness' : ''}</p>}
                        {holding.quoteSnapshots.length > 1 && (
                          <p className="text-xs text-content-tertiary">
                            Since prior recorded quote: {(Number(holding.quoteSnapshots[0].price) - Number(holding.quoteSnapshots[1].price)) >= 0 ? '+' : ''}{(Number(holding.quoteSnapshots[0].price) - Number(holding.quoteSnapshots[1].price)).toFixed(2)} per unit.
                          </p>
                        )}
                        <button onClick={() => {
                          setEditingQuote(holding.id);
                          setQuotePrice(holding.quotePrice ?? '');
                          setQuoteSource(holding.quoteSource ?? 'Manual entry');
                          setQuoteAsOf(holding.quoteAsOf?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
                        }} className="mt-1 block text-xs text-accent-blue hover:underline">record quote</button>
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    {editingHolding === holding.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => updateHolding.mutate({ id: holding.id, quantity: editQuantity, costBasis: editCostBasis || null })} disabled={!editQuantity || updateHolding.isPending} className="text-xs text-accent-blue hover:underline">Save</button>
                        <button onClick={() => setEditingHolding(null)} className="text-xs text-content-tertiary hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingHolding(holding.id); setEditQuantity(holding.quantity); setEditCostBasis(holding.costBasis ?? ''); }} className="text-xs text-accent-blue hover:underline">Edit</button>
                        <button onClick={() => {
                          if (confirm(`Remove ${holding.symbol}?`)) removeHolding.mutate(holding.id);
                        }} className="text-xs text-accent-red hover:underline" disabled={removeHolding.isPending}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card py-12 text-center text-sm text-content-secondary">
          No holdings recorded yet. Add your first factual holding above.
        </div>
      )}
    </div>
  );
}
