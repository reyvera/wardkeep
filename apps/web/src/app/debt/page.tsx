'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, Calculator, BarChart3, Trash2, CreditCard } from 'lucide-react';

interface Debt { name: string; balance: number; apr: number; minimumPayment: number; }
interface ScheduleRow { month: number; payment: number; interest: number; balance: number; debtName: string; }
interface PayoffResult { schedule: ScheduleRow[]; totalInterest: number; totalMonths: number; }

function formatCurrency(value: number): string { return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche' | 'custom'>('avalanche');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [scheduleResult, setScheduleResult] = useState<PayoffResult | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, PayoffResult> | null>(null);
  const [newDebt, setNewDebt] = useState({ name: '', balance: '', apr: '', minimumPayment: '' });

  const calculateMutation = useMutation({ mutationFn: () => apiClient.post<PayoffResult>('/debt/calculate', { debts, strategy, totalMonthlyPayment: parseFloat(monthlyPayment) || 0 }), onSuccess: (data) => setScheduleResult(data) });
  const compareMutation = useMutation({ mutationFn: () => apiClient.post<Record<string, PayoffResult>>('/debt/compare', { debts, totalMonthlyPayment: parseFloat(monthlyPayment) || 0 }), onSuccess: (data) => setCompareResult(data) });

  const addDebt = (e: React.FormEvent) => { e.preventDefault(); setDebts([...debts, { name: newDebt.name, balance: parseFloat(newDebt.balance) || 0, apr: parseFloat(newDebt.apr) || 0, minimumPayment: parseFloat(newDebt.minimumPayment) || 0 }]); setNewDebt({ name: '', balance: '', apr: '', minimumPayment: '' }); };
  const removeDebt = (index: number) => setDebts(debts.filter((_, i) => i !== index));
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Debt Payoff</h1>

      {debts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card"><span className="card-title">TOTAL DEBT</span><p className="text-2xl font-bold tabular-nums text-accent-red">${formatCurrency(totalDebt)}</p></div>
          <div className="card"><span className="card-title">DEBTS</span><p className="text-2xl font-bold tabular-nums text-content-primary">{debts.length}</p></div>
          <div className="card"><span className="card-title">AVG APR</span><p className="text-2xl font-bold tabular-nums text-content-primary">{debts.length > 0 ? (debts.reduce((sum, d) => sum + d.apr, 0) / debts.length).toFixed(1) : '0.0'}%</p></div>
        </div>
      )}

      <form onSubmit={addDebt} className="card space-y-4">
        <span className="card-title">ADD DEBT</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className="input-label">Name</label><input placeholder="e.g. Visa Card" value={newDebt.name} onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })} className="input" required /></div>
          <div><label className="input-label">Balance</label><input placeholder="0.00" type="number" step="0.01" value={newDebt.balance} onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value })} className="input" required /></div>
          <div><label className="input-label">APR %</label><input placeholder="0.00" type="number" step="0.01" value={newDebt.apr} onChange={(e) => setNewDebt({ ...newDebt, apr: e.target.value })} className="input" required /></div>
          <div><label className="input-label">Min Payment</label><input placeholder="0.00" type="number" step="0.01" value={newDebt.minimumPayment} onChange={(e) => setNewDebt({ ...newDebt, minimumPayment: e.target.value })} className="input" required /></div>
        </div>
        <button type="submit" className="btn-primary"><Plus size={16} /> Add Debt</button>
      </form>

      {debts.length > 0 && (
        <div className="space-y-2">
          {debts.map((d, i) => (
            <div key={i} className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-red/10"><CreditCard size={16} className="text-accent-red" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-content-primary">{d.name}</p><p className="text-xs text-content-tertiary">{d.apr}% APR · Min: ${formatCurrency(d.minimumPayment)}</p></div>
              <p className="text-sm font-bold tabular-nums text-accent-red">${formatCurrency(d.balance)}</p>
              <button onClick={() => removeDebt(i)} className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" title="Remove"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {debts.length > 0 && (
        <div className="card space-y-4">
          <span className="card-title">CALCULATE PAYOFF</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="input-label">Strategy</label><select value={strategy} onChange={(e) => setStrategy(e.target.value as 'snowball' | 'avalanche' | 'custom')} className="input"><option value="avalanche">Avalanche (highest APR first)</option><option value="snowball">Snowball (lowest balance first)</option><option value="custom">Custom order</option></select></div>
            <div><label className="input-label">Total Monthly Payment</label><input placeholder="0.00" type="number" step="0.01" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} className="input" /></div>
            <div className="flex items-end gap-2">
              <button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending} className="btn-primary"><Calculator size={16} /> {calculateMutation.isPending ? 'Calculating...' : 'Calculate'}</button>
              <button onClick={() => compareMutation.mutate()} disabled={compareMutation.isPending} className="btn-secondary"><BarChart3 size={16} /> Compare</button>
            </div>
          </div>
          {calculateMutation.isError && <p className="text-sm text-accent-red">{calculateMutation.error.message}</p>}
        </div>
      )}

      {compareResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(compareResult).map(([name, result]) => (
            <div key={name} className="card"><span className="card-title">{name.toUpperCase()}</span><p className="text-lg font-bold tabular-nums text-content-primary">{result.totalMonths} months</p><p className="text-sm text-content-secondary tabular-nums">${formatCurrency(result.totalInterest)} total interest</p></div>
          ))}
        </div>
      )}

      {scheduleResult && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 pt-6 pb-4"><span className="card-title">PAYOFF SCHEDULE</span><p className="text-sm text-content-secondary mt-1">{scheduleResult.totalMonths} months · ${formatCurrency(scheduleResult.totalInterest)} total interest</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-t border-b border-edge"><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Month</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Debt</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Payment</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Interest</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-edge">
                {scheduleResult.schedule.slice(0, 60).map((row, i) => (
                  <tr key={i} className="hover:bg-surface-elevated transition-colors"><td className="px-6 py-3 text-content-primary tabular-nums">{row.month}</td><td className="px-6 py-3 text-content-secondary">{row.debtName}</td><td className="px-6 py-3 text-right tabular-nums text-content-primary">${formatCurrency(row.payment)}</td><td className="px-6 py-3 text-right tabular-nums text-accent-red">${formatCurrency(row.interest)}</td><td className="px-6 py-3 text-right tabular-nums text-content-primary">${formatCurrency(row.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {debts.length === 0 && !scheduleResult && (
        <div className="card text-center py-12"><CreditCard size={40} className="mx-auto text-content-tertiary mb-3" /><p className="text-content-secondary text-sm">No debts added yet</p><p className="text-content-tertiary text-xs mt-1">Add your debts above to calculate a payoff plan</p></div>
      )}
    </div>
  );
}
