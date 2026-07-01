'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Rule {
  id: string;
  name: string;
  priority: number;
  conditions: Array<{ field: string; operator: string; value: string }>;
  action: { type: string; value: string };
}

interface DryRunResult {
  matchedCount: number;
  transactions: Array<{ id: string; merchant: string; amount: number }>;
}

export default function RulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  // Create form state
  const [newRule, setNewRule] = useState({
    name: '',
    priority: 0,
    conditionField: 'merchant',
    conditionOperator: 'contains',
    conditionValue: '',
    actionType: 'categorize',
    actionValue: '',
  });

  const rulesQuery = useQuery({
    queryKey: ['rules'],
    queryFn: () => apiClient.get<Rule[]>('/rules'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/rules', {
        name: newRule.name,
        priority: newRule.priority,
        conditions: [
          {
            field: newRule.conditionField,
            operator: newRule.conditionOperator,
            value: newRule.conditionValue,
          },
        ],
        action: { type: newRule.actionType, value: newRule.actionValue },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setShowForm(false);
      setNewRule({
        name: '',
        priority: 0,
        conditionField: 'merchant',
        conditionOperator: 'contains',
        conditionValue: '',
        actionType: 'categorize',
        actionValue: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });

  const dryRunMutation = useMutation({
    mutationFn: () => apiClient.post<DryRunResult>('/rules/dry-run'),
    onSuccess: (data) => setDryRunResult(data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rules</h1>
        <div className="flex gap-2">
          <button
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {dryRunMutation.isPending ? 'Running...' : 'Dry Run'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'Create Rule'}
          </button>
        </div>
      </div>

      {dryRunResult && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-medium text-blue-800">
            Dry Run: {dryRunResult.matchedCount} transactions would be affected
          </p>
        </div>
      )}

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
              placeholder="Rule name"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              placeholder="Priority"
              type="number"
              value={newRule.priority}
              onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <select
              value={newRule.conditionField}
              onChange={(e) => setNewRule({ ...newRule, conditionField: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="merchant">Merchant</option>
              <option value="amount">Amount</option>
              <option value="description">Description</option>
            </select>
            <select
              value={newRule.conditionOperator}
              onChange={(e) => setNewRule({ ...newRule, conditionOperator: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="greater_than">Greater than</option>
              <option value="less_than">Less than</option>
            </select>
            <input
              placeholder="Condition value"
              value={newRule.conditionValue}
              onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              placeholder="Action value (e.g. category name)"
              value={newRule.actionValue}
              onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Save Rule'}
          </button>
        </form>
      )}

      {rulesQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {rulesQuery.isError && <p className="text-red-600">{rulesQuery.error.message}</p>}
      {rulesQuery.data && (
        <div className="space-y-3">
          {rulesQuery.data.length === 0 && (
            <p className="text-gray-500">No rules configured yet.</p>
          )}
          {rulesQuery.data.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-sm text-gray-500">
                  Priority: {rule.priority} ·{' '}
                  {rule.conditions.map((c) => `${c.field} ${c.operator} "${c.value}"`).join(', ')}
                  {' → '}{rule.action.type}: {rule.action.value}
                </p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(rule.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
