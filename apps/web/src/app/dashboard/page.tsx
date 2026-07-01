'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface NetWorth {
  assets: number;
  liabilities: number;
  netWorth: number;
}

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  type: string;
}

export default function DashboardPage() {
  const netWorthQuery = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => apiClient.get<NetWorth>('/accounts/net-worth'),
  });

  const transactionsQuery = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () =>
      apiClient.get<{ data: Transaction[] }>('/transactions?pageSize=5'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Net Worth Card */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Net Worth</h2>
        {netWorthQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {netWorthQuery.isError && (
          <p className="text-red-600">{netWorthQuery.error.message}</p>
        )}
        {netWorthQuery.data && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Assets</p>
              <p className="text-xl font-bold text-green-600">
                ${Number(netWorthQuery.data.assets).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Liabilities</p>
              <p className="text-xl font-bold text-red-600">
                ${Number(netWorthQuery.data.liabilities).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold">
                ${Number(netWorthQuery.data.netWorth).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        {transactionsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
        {transactionsQuery.isError && (
          <p className="text-red-600">{transactionsQuery.error.message}</p>
        )}
        {transactionsQuery.data && (
          <ul className="divide-y divide-gray-100">
            {transactionsQuery.data.data.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{tx.merchant}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.date).toLocaleDateString()} · {tx.category}
                  </p>
                </div>
                <span
                  className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {tx.type === 'income' ? '+' : '-'}$
                  {Math.abs(Number(tx.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </li>
            ))}
            {transactionsQuery.data.data.length === 0 && (
              <p className="text-gray-500 py-2">No transactions yet.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
