'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Debt {
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
}

interface ScheduleRow {
  month: number;
  payment: number;
  interest: number;
  balance: number;
  debtName: string;
}

interface PayoffResult {
  schedule: ScheduleRow[];
  totalInterest: number;
  totalMonths: number;
}

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche' | 'custom'>('avalanche');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [scheduleResult, setScheduleResult] = useState<PayoffResult | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, PayoffResult> | null>(null);

  // Form for adding a debt
  const [newDebt, setNewDebt] = useState({ name: '', balance: '', apr: '', minimumPayment: '' });

  const calculateMutation = useMutation({
    mutationFn: () =>
      apiClient.post<PayoffResult>('/debt/calculate', {
        debts,
        strategy,
        totalMonthlyPayment: parseFloat(monthlyPayment) || 0,
      }),
    onSuccess: (data) => setScheduleResult(data),
  });

  const compareMutation = useMutation({
    mutationFn: () =>
      apiClient.post<Record<string, PayoffResult>>('/debt/compare', {
        debts,
        totalMonthlyPayment: parseFloat(monthlyPayment) || 0,
      }),
    onSuccess: (data) => setCompareResult(data),
  });

  const addDebt = (e: React.FormEvent) => {
    e.preventDefault();
    setDebts([
      ...debts,
      {
        name: newDebt.name,
        balance: parseFloat(newDebt.balance) || 0,
        apr: parseFloat(newDebt.apr) || 0,
        minimumPayment: parseFloat(newDebt.minimumPayment) || 0,
      },
    ]);
    setNewDebt({ name: '', balance: '', apr: '', minimumPayment: '' });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Debt Payoff</h1>

      {/* Add debt form */}
      <form onSubmit={addDebt} className="rounded-lg bg-white p-4 shadow-sm mb-6 space-y-3">
        <h2 className="font-semibold">Add Debt</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            placeholder="Name"
            value={newDebt.name}
            onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2"
            required
          />
          <input
            placeholder="Balance"
            type="number"
            step="0.01"
            value={newDebt.balance}
            onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2"
            required
          />
          <input
            placeholder="APR %"
            type="number"
            step="0.01"
            value={newDebt.apr}
            onChange={(e) => setNewDebt({ ...newDebt, apr: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2"
            required
          />
          <input
            placeholder="Min Payment"
            type="number"
            step="0.01"
            value={newDebt.minimumPayment}
            onChange={(e) => setNewDebt({ ...newDebt, minimumPayment: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          Add Debt
        </button>
      </form>

      {/* Debt list */}
      {debts.length > 0 && (
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Your Debts</h2>
          <ul className="divide-y text-sm">
            {debts.map((d, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{d.name}</span>
                <span className="text-gray-500">
                  ${d.balance.toFixed(2)} @ {d.apr}% APR · Min: ${d.minimumPayment.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strategy and calculate */}
      <div className="rounded-lg bg-white p-4 shadow-sm mb-6 space-y-3">
        <h2 className="font-semibold">Calculate Payoff</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as 'snowball' | 'avalanche' | 'custom')}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="avalanche">Avalanche (highest APR first)</option>
            <option value="snowball">Snowball (lowest balance first)</option>
            <option value="custom">Custom order</option>
          </select>
          <input
            placeholder="Total monthly payment"
            type="number"
            step="0.01"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => calculateMutation.mutate()}
              disabled={debts.length === 0 || calculateMutation.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
            </button>
            <button
              onClick={() => compareMutation.mutate()}
              disabled={debts.length === 0 || compareMutation.isPending}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Compare Strategies
            </button>
          </div>
        </div>
        {calculateMutation.isError && (
          <p className="text-sm text-red-600">{calculateMutation.error.message}</p>
        )}
      </div>

      {/* Compare result */}
      {compareResult && (
        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h3 className="font-medium text-blue-800 mb-2">Strategy Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {Object.entries(compareResult).map(([name, result]) => (
              <div key={name} className="rounded bg-white p-3">
                <p className="font-medium capitalize">{name}</p>
                <p className="text-gray-600">
                  {result.totalMonths} months · ${result.totalInterest.toFixed(2)} interest
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule table */}
      {scheduleResult && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <div className="p-4">
            <h3 className="font-medium">
              Payoff Schedule — {scheduleResult.totalMonths} months, $
              {scheduleResult.totalInterest.toFixed(2)} total interest
            </h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Debt</th>
                <th className="px-4 py-3 font-medium text-right">Payment</th>
                <th className="px-4 py-3 font-medium text-right">Interest</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scheduleResult.schedule.slice(0, 60).map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{row.month}</td>
                  <td className="px-4 py-2">{row.debtName}</td>
                  <td className="px-4 py-2 text-right font-mono">${row.payment.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono">${row.interest.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono">${row.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scheduleResult.schedule.length > 60 && (
            <p className="p-4 text-sm text-gray-500">
              Showing first 60 rows of {scheduleResult.schedule.length} total.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
