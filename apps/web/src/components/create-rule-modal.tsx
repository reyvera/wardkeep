'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { X, Zap, Play, Check } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  categoryId: string | null;
  description?: string;
}

interface PreviewResult {
  matchedCount: number;
  transactions: Array<{
    id: string;
    date: string;
    amount: string;
    type: string;
    merchant: string;
    description: string | null;
    categoryId: string | null;
  }>;
}

interface CreateRuleModalProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}

const CONDITION_FIELDS = [
  { value: 'MERCHANT', label: 'Merchant' },
  { value: 'DESCRIPTION', label: 'Description' },
  { value: 'AMOUNT', label: 'Amount' },
];

const OPERATORS = [
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'EQUALS', label: 'Equals' },
  { value: 'STARTS_WITH', label: 'Starts with' },
  { value: 'REGEX', label: 'Regex' },
  { value: 'GREATER_THAN', label: 'Greater than' },
  { value: 'LESS_THAN', label: 'Less than' },
];

const ACTION_TYPES = [
  { value: 'SET_CATEGORY', label: 'Set Category' },
  { value: 'ADD_TAG', label: 'Add Tag' },
  { value: 'SET_MERCHANT', label: 'Set Merchant' },
  { value: 'ADD_NOTE', label: 'Add Note' },
];

/**
 * Modal for creating a rule prefilled from a transaction.
 * Allows editing all rule fields and previewing matching transactions before saving.
 * @param transaction - The source transaction to prefill from
 * @param categories - Available categories for the action value picker
 * @param onClose - Callback when the modal is dismissed
 */
export function CreateRuleModal({ transaction, categories, onClose }: CreateRuleModalProps) {
  const queryClient = useQueryClient();

  const categoryName = transaction.categoryId
    ? categories.find((c) => c.id === transaction.categoryId)?.name ?? ''
    : '';

  const defaultMatchValue = transaction.merchant || '';
  const defaultField = transaction.merchant ? 'MERCHANT' : 'DESCRIPTION';

  const [ruleName, setRuleName] = useState(
    `Categorize ${defaultMatchValue || 'transaction'} as ${categoryName}`,
  );
  const [priority, setPriority] = useState(0);
  const [conditionField, setConditionField] = useState(defaultField);
  const [conditionOperator, setConditionOperator] = useState('CONTAINS');
  const [conditionValue, setConditionValue] = useState(defaultMatchValue);
  const [actionType, setActionType] = useState('SET_CATEGORY');
  const [actionValue, setActionValue] = useState(transaction.categoryId ?? '');
  const [applyRetroactively, setApplyRetroactively] = useState(false);

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  const buildPayload = () => ({
    name: ruleName,
    ...(priority > 0 && { priority }),
    isActive: true,
    logic: 'ALL',
    conditions: [{ field: conditionField, operator: conditionOperator, value: conditionValue }],
    actions: [{ type: actionType, value: actionValue }],
  });

  const previewMutation = useMutation({
    mutationFn: () => apiClient.post<PreviewResult>('/rules/preview', buildPayload()),
    onSuccess: (data) => setPreviewResult(data),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const rule = await apiClient.post<{ id: string }>('/rules', buildPayload());
      if (applyRetroactively && rule.id) {
        await apiClient.post(`/rules/${rule.id}/apply`);
      }
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
  });

  const isFormValid = ruleName.trim() && conditionValue.trim() && actionValue.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-primary border border-edge rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-edge">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-accent-purple" />
            <h2 className="text-sm font-semibold text-content-primary">Create Rule from Transaction</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-content-tertiary hover:text-content-primary">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {createMutation.isError && (
            <p className="text-sm text-accent-red">{createMutation.error.message}</p>
          )}

          {/* Rule Name */}
          <div>
            <label className="input-label">Rule Name</label>
            <input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="input"
              placeholder="e.g. Categorize Netflix as Entertainment"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="input-label">Priority (optional, lower = higher priority)</label>
            <input
              type="number"
              value={priority || ''}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="input"
              placeholder="Auto-assigned if left blank"
              min={0}
            />
          </div>

          {/* Condition */}
          <fieldset className="border border-edge rounded-lg p-3 space-y-3">
            <legend className="text-xs font-medium text-content-secondary px-1">Condition</legend>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="input-label">Field</label>
                <select
                  value={conditionField}
                  onChange={(e) => setConditionField(e.target.value)}
                  className="input"
                >
                  {CONDITION_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Operator</label>
                <select
                  value={conditionOperator}
                  onChange={(e) => setConditionOperator(e.target.value)}
                  className="input"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Value</label>
                <input
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="input"
                  placeholder="Match value"
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Action */}
          <fieldset className="border border-edge rounded-lg p-3 space-y-3">
            <legend className="text-xs font-medium text-content-secondary px-1">Action</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="input-label">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="input"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">
                  {actionType === 'SET_CATEGORY' ? 'Category' : 'Value'}
                </label>
                {actionType === 'SET_CATEGORY' ? (
                  <select
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className="input"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className="input"
                    placeholder="Action value"
                    required
                  />
                )}
              </div>
            </div>
          </fieldset>

          {/* Retroactive option */}
          <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={applyRetroactively}
              onChange={(e) => setApplyRetroactively(e.target.checked)}
              className="rounded border-edge"
            />
            Apply rule to existing matching transactions
          </label>

          {/* Preview Section */}
          {previewResult && (
            <div className="border border-accent-blue/30 rounded-lg p-3 bg-accent-blue/5">
              <p className="text-xs font-medium text-accent-blue mb-2">
                Preview: {previewResult.matchedCount} transaction{previewResult.matchedCount !== 1 ? 's' : ''} would match
              </p>
              {previewResult.transactions.length > 0 && (
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {previewResult.transactions.map((tx) => (
                    <li key={tx.id} className="text-[11px] text-content-secondary flex justify-between">
                      <span className="truncate">{tx.merchant || tx.description || 'Unknown'}</span>
                      <span className="tabular-nums ml-2">${Math.abs(Number(tx.amount)).toFixed(2)}</span>
                    </li>
                  ))}
                  {previewResult.matchedCount > 20 && (
                    <li className="text-[11px] text-content-tertiary italic">
                      ...and {previewResult.matchedCount - 20} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-edge">
          <button
            onClick={() => previewMutation.mutate()}
            disabled={!isFormValid || previewMutation.isPending}
            className="btn-secondary text-xs"
          >
            <Play size={14} />
            {previewMutation.isPending ? 'Checking...' : 'Preview Matches'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!isFormValid || createMutation.isPending}
              className="btn-primary text-xs"
            >
              <Check size={14} />
              {createMutation.isPending ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
