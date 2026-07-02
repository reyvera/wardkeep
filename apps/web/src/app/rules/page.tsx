'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, Trash2, Zap, Play, X } from 'lucide-react';

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
  const [newRule, setNewRule] = useState({ name: '', priority: 0, conditionField: 'merchant', conditionOperator: 'contains', conditionValue: '', actionType: 'categorize', actionValue: '' });

  const rulesQuery = useQuery({ queryKey: ['rules'], queryFn: () => apiClient.get<Rule[]>('/rules') });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/rules', { name: newRule.name, priority: newRule.priority, conditions: [{ field: newRule.conditionField, operator: newRule.conditionOperator, value: newRule.conditionValue }], action: { type: newRule.actionType, value: newRule.actionValue } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rules'] }); setShowForm(false); setNewRule({ name: '', priority: 0, conditionField: 'merchant', conditionOperator: 'contains', conditionValue: '', actionType: 'categorize', actionValue: '' }); },
  });

  const deleteMutation = useMutation({ mutationFn: (id: string) => apiClient.delete(`/rules/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }) });
  const dryRunMutation = useMutation({ mutationFn: () => apiClient.post<DryRunResult>('/rules/dry-run'), onSuccess: (data) => setDryRunResult(data) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Rules</h1>
        <div className="flex gap-2">
          <button onClick={() => dryRunMutation.mutate()} disabled={dryRunMutation.isPending} className="btn-secondary">
            <Play size={16} /> {dryRunMutation.isPending ? 'Running...' : 'Dry Run'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn-secondary' : 'btn-primary'}>
            {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Create Rule</>}
          </button>
        </div>
      </div>

      {dryRunResult && (
        <div className="card border-accent-blue/30">
          <p className="text-sm font-medium text-accent-blue">Dry Run: {dryRunResult.matchedCount} transactions would be affected</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="card space-y-4">
          {createMutation.isError && <p className="text-sm text-accent-red">{createMutation.error.message}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className="input-label">Rule Name</label><input placeholder="e.g. Categorize Netflix" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} className="input" required /></div>
            <div><label className="input-label">Priority</label><input placeholder="0" type="number" value={newRule.priority} onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })} className="input" /></div>
            <div><label className="input-label">Match Field</label><select value={newRule.conditionField} onChange={(e) => setNewRule({ ...newRule, conditionField: e.target.value })} className="input"><option value="merchant">Merchant</option><option value="amount">Amount</option><option value="description">Description</option></select></div>
            <div><label className="input-label">Operator</label><select value={newRule.conditionOperator} onChange={(e) => setNewRule({ ...newRule, conditionOperator: e.target.value })} className="input"><option value="contains">Contains</option><option value="equals">Equals</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option></select></div>
            <div><label className="input-label">Value</label><input placeholder="Match value" value={newRule.conditionValue} onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })} className="input" required /></div>
            <div><label className="input-label">Action Value</label><input placeholder="e.g. Entertainment" value={newRule.actionValue} onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })} className="input" required /></div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">{createMutation.isPending ? 'Creating...' : 'Save Rule'}</button>
        </form>
      )}

      {rulesQuery.isLoading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card flex items-center gap-4 py-4"><div className="skeleton w-8 h-8 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-64" /></div></div>)}</div>}
      {rulesQuery.isError && <div className="card"><p className="text-accent-red text-sm">{rulesQuery.error.message}</p></div>}

      {rulesQuery.data && rulesQuery.data.length > 0 && (
        <div className="space-y-2">
          {rulesQuery.data.map((rule) => (
            <div key={rule.id} className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-purple/10"><Zap size={16} className="text-accent-purple" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary">{rule.name}</p>
                <p className="text-xs text-content-tertiary truncate">Priority {rule.priority} · {rule.conditions.map((c) => `${c.field} ${c.operator} "${c.value}"`).join(', ')} → {rule.action.type}: {rule.action.value}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(rule.id)} className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" title="Delete rule"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {rulesQuery.data && rulesQuery.data.length === 0 && (
        <div className="card text-center py-12">
          <Zap size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary text-sm">No rules configured yet</p>
          <p className="text-content-tertiary text-xs mt-1">Create rules to automatically categorize transactions</p>
        </div>
      )}
    </div>
  );
}
