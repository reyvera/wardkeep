'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Plus,
  Calculator,
  BarChart3,
  Trash2,
  CreditCard,
  RefreshCw,
  Link2,
  Check,
  Save,
  BookMarked,
  TrendingDown,
  Landmark,
  Zap,
} from 'lucide-react';

interface Debt {
  id?: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  isFromAccount?: boolean;
}

interface DebtSchedule {
  debtId: string;
  debtName: string;
  months: Array<{ month: number; payment: string; interest: string; remainingBalance: string }>;
  totalInterest: string;
  totalPaid: string;
  payoffMonth: number;
}

interface PayoffResult {
  schedules: DebtSchedule[];
  totalInterest: string;
  totalMonths: number;
  debtFreeDate: number;
  warning?: string;
}

interface StrategyResult {
  strategy: string;
  result: PayoffResult;
}
interface CompareResult {
  strategies: StrategyResult[];
  interestSavings: string;
  timeSavings: number;
}

interface ConsolidationResult {
  schedule: DebtSchedule;
  monthlyPayment: string;
  totalInterest: string;
  totalCost: string;
  interestSavingsVsBaseline: string;
  timeSavingsVsBaseline: number;
  warning?: string;
}

interface VelocityBankingResult {
  schedules: DebtSchedule[];
  totalInterest: string;
  helocInterest: string;
  combinedInterest: string;
  totalMonths: number;
  interestSavingsVsBaseline: string;
  timeSavingsVsBaseline: number;
  warning?: string;
}

interface AccountDebt {
  id: string;
  name: string;
  balance: string;
  apr: string;
  minimumPayment: string;
  priority: number;
}

interface DebtProfileResponse {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  apr: string;
  minimumPayment: string;
  assetValue: string | null;
  priority: number;
}

interface SavedPlan {
  id: string;
  name: string;
  accountIds: string[];
  strategy: string;
  totalMonthlyPayment: string;
  totalInterest: string;
  totalMonths: number;
  createdAt: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DebtPage() {
  const queryClient = useQueryClient();
  const [manualDebts, setManualDebts] = useState<Debt[]>([]);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche' | 'custom'>('avalanche');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [scheduleResult, setScheduleResult] = useState<PayoffResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [newDebt, setNewDebt] = useState({ name: '', balance: '', apr: '', minimumPayment: '' });
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ apr: '', minimumPayment: '', assetValue: '' });
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [planName, setPlanName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scheduleViewMax, setScheduleViewMax] = useState(24);
  const [activeTab, setActiveTab] = useState<'standard' | 'consolidation' | 'velocity'>('standard');
  const [consolidationParams, setConsolidationParams] = useState({
    newApr: '',
    termMonths: '60',
    originationFee: '',
  });
  const [velocityParams, setVelocityParams] = useState({
    helocLimit: '',
    helocApr: '',
    monthlyDisposableIncome: '',
    chunkAmount: '',
  });
  const [consolidationResult, setConsolidationResult] = useState<ConsolidationResult | null>(null);
  const [velocityResult, setVelocityResult] = useState<VelocityBankingResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<PayoffResult | null>(null);

  // Fetch debts auto-synced from accounts
  const {
    data: accountDebts = [],
    isLoading,
    refetch,
  } = useQuery<AccountDebt[]>({
    queryKey: ['debt-from-accounts'],
    queryFn: () => apiClient.get<AccountDebt[]>('/debt/from-accounts'),
  });

  // Fetch debt profiles for editing
  const { data: profiles = [] } = useQuery<DebtProfileResponse[]>({
    queryKey: ['debt-profiles'],
    queryFn: () => apiClient.get<DebtProfileResponse[]>('/debt/profiles'),
  });

  // Fetch saved plans
  const { data: savedPlans = [] } = useQuery<SavedPlan[]>({
    queryKey: ['debt-plans'],
    queryFn: () => apiClient.get<SavedPlan[]>('/debt/plans'),
  });

  // Initialize selection to all accounts once loaded
  if (accountDebts.length > 0 && selectedAccountIds.size === 0) {
    const allIds = new Set(accountDebts.map((d) => d.id));
    if (allIds.size > 0 && selectedAccountIds.size === 0) {
      setSelectedAccountIds(allIds);
    }
  }

  // Build debt list from selected accounts + manual debts
  const selectedAccountDebts = accountDebts
    .filter((d) => selectedAccountIds.has(d.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: parseFloat(d.balance) || 0,
      apr: parseFloat(d.apr) * 100,
      minimumPayment: parseFloat(d.minimumPayment) || 0,
      isFromAccount: true,
    }));

  const allDebts: Debt[] = [...selectedAccountDebts, ...manualDebts];

  // Debts ready for calculation (have APR + min payment configured)
  const configuredDebts = allDebts.filter((d) =>
    d.isFromAccount ? d.apr > 0 && d.minimumPayment > 0 : true,
  );

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedAccountIds(new Set(accountDebts.map((d) => d.id)));
  const selectNone = () => setSelectedAccountIds(new Set());

  const calculateMutation = useMutation({
    mutationFn: () => {
      const debtsPayload = configuredDebts.map((d, i) => ({
        id: d.id || `manual-${i}`,
        name: d.name,
        balance: d.balance.toFixed(2),
        apr: (d.apr / 100).toFixed(4),
        minimumPayment: d.minimumPayment.toFixed(2),
      }));
      return apiClient.post<PayoffResult>('/debt/calculate', {
        debts: debtsPayload,
        strategy,
        totalMonthlyPayment: (parseFloat(monthlyPayment) || 0).toFixed(2),
      });
    },
    onSuccess: (data) => {
      setScheduleResult(data);
      setCompareResult(null);
    },
  });

  const compareMutation = useMutation({
    mutationFn: () => {
      const debtsPayload = configuredDebts.map((d, i) => ({
        id: d.id || `manual-${i}`,
        name: d.name,
        balance: d.balance.toFixed(2),
        apr: (d.apr / 100).toFixed(4),
        minimumPayment: d.minimumPayment.toFixed(2),
      }));
      return apiClient.post<CompareResult>('/debt/compare', {
        debts: debtsPayload,
        strategies: ['snowball', 'avalanche', 'custom'],
        totalMonthlyPayment: (parseFloat(monthlyPayment) || 0).toFixed(2),
      });
    },
    onSuccess: (data) => {
      setCompareResult(data);
      setScheduleResult(null);
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: (data: { name: string; totalInterest: string; totalMonths: number }) =>
      apiClient.post('/debt/plans', {
        name: data.name,
        accountIds: Array.from(selectedAccountIds),
        strategy,
        totalMonthlyPayment: (parseFloat(monthlyPayment) || 0).toFixed(2),
        totalInterest: data.totalInterest,
        totalMonths: data.totalMonths,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-plans'] });
      setShowSaveDialog(false);
      setPlanName('');
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => apiClient.delete(`/debt/plans/${planId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debt-plans'] }),
  });

  const consolidationMutation = useMutation({
    mutationFn: () => {
      const debtsPayload = configuredDebts.map((d, i) => ({
        id: d.id || `manual-${i}`,
        name: d.name,
        balance: d.balance.toFixed(2),
        apr: (d.apr / 100).toFixed(4),
        minimumPayment: d.minimumPayment.toFixed(2),
      }));
      return apiClient.post<ConsolidationResult>('/debt/consolidation', {
        debts: debtsPayload,
        newApr: (parseFloat(consolidationParams.newApr) / 100).toFixed(4),
        termMonths: parseInt(consolidationParams.termMonths) || 60,
        ...(consolidationParams.originationFee && {
          originationFee: (parseFloat(consolidationParams.originationFee) / 100).toFixed(4),
        }),
      });
    },
    onSuccess: (data) => {
      setConsolidationResult(data);
    },
  });

  const velocityMutation = useMutation({
    mutationFn: () => {
      const debtsPayload = configuredDebts.map((d, i) => ({
        id: d.id || `manual-${i}`,
        name: d.name,
        balance: d.balance.toFixed(2),
        apr: (d.apr / 100).toFixed(4),
        minimumPayment: d.minimumPayment.toFixed(2),
      }));
      return apiClient.post<VelocityBankingResult>('/debt/velocity-banking', {
        debts: debtsPayload,
        helocLimit: (parseFloat(velocityParams.helocLimit) || 0).toFixed(2),
        helocApr: (parseFloat(velocityParams.helocApr) / 100).toFixed(4),
        monthlyDisposableIncome: (parseFloat(velocityParams.monthlyDisposableIncome) || 0).toFixed(
          2,
        ),
        chunkAmount: (parseFloat(velocityParams.chunkAmount) || 0).toFixed(2),
      });
    },
    onSuccess: (data) => {
      setVelocityResult(data);
    },
  });

  const baselineMutation = useMutation({
    mutationFn: () => {
      const debtsPayload = configuredDebts.map((d, i) => ({
        id: d.id || `manual-${i}`,
        name: d.name,
        balance: d.balance.toFixed(2),
        apr: (d.apr / 100).toFixed(4),
        minimumPayment: d.minimumPayment.toFixed(2),
      }));
      return apiClient.post<PayoffResult>('/debt/minimum-only', { debts: debtsPayload });
    },
    onSuccess: (data) => {
      setBaselineResult(data);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({
      profileId,
      apr,
      minimumPayment,
      assetValue,
    }: {
      profileId: string;
      apr: string;
      minimumPayment: string;
      assetValue?: string | null;
    }) =>
      apiClient.patch(`/debt/profiles/${profileId}`, {
        apr,
        minimumPayment,
        ...(assetValue !== undefined && { assetValue: assetValue || null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-from-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      setEditingProfile(null);
    },
  });

  const addDebt = (e: React.FormEvent) => {
    e.preventDefault();
    setManualDebts([
      ...manualDebts,
      {
        name: newDebt.name,
        balance: parseFloat(newDebt.balance) || 0,
        apr: parseFloat(newDebt.apr) || 0,
        minimumPayment: parseFloat(newDebt.minimumPayment) || 0,
      },
    ]);
    setNewDebt({ name: '', balance: '', apr: '', minimumPayment: '' });
  };

  const removeManualDebt = (index: number) =>
    setManualDebts(manualDebts.filter((_, i) => i !== index));
  const totalDebt = allDebts.reduce((sum, d) => sum + d.balance, 0);

  const startEditing = (profile: DebtProfileResponse) => {
    setEditingProfile(profile.id);
    setEditValues({
      apr: (parseFloat(profile.apr) * 100).toFixed(2),
      minimumPayment: profile.minimumPayment,
      assetValue: profile.assetValue ?? '',
    });
  };

  const saveProfile = (profileId: string) => {
    updateProfileMutation.mutate({
      profileId,
      apr: editValues.apr,
      minimumPayment: editValues.minimumPayment,
      assetValue: editValues.assetValue || null,
    });
  };

  const handleSavePlan = () => {
    if (!planName.trim()) return;
    const interest =
      scheduleResult?.totalInterest || compareResult?.strategies[0]?.result.totalInterest || '0';
    const months =
      scheduleResult?.totalMonths || compareResult?.strategies[0]?.result.totalMonths || 0;
    savePlanMutation.mutate({ name: planName, totalInterest: interest, totalMonths: months });
  };

  const loadPlan = (plan: SavedPlan) => {
    setSelectedAccountIds(new Set(plan.accountIds));
    setStrategy(plan.strategy as 'snowball' | 'avalanche' | 'custom');
    setMonthlyPayment(plan.totalMonthlyPayment);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Debt Payoff</h1>
        <button
          onClick={() => refetch()}
          className="btn-ghost flex items-center gap-1 text-sm text-content-secondary"
          title="Refresh debts from accounts"
        >
          <RefreshCw size={14} /> Sync
        </button>
      </div>

      {/* Summary Cards */}
      {allDebts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <span className="card-title">SELECTED DEBT</span>
            <p className="text-2xl font-bold tabular-nums text-accent-red">
              ${formatCurrency(totalDebt)}
            </p>
          </div>
          <div className="card">
            <span className="card-title">ACCOUNTS</span>
            <p className="text-2xl font-bold tabular-nums text-content-primary">
              {selectedAccountIds.size}/{accountDebts.length}
              {manualDebts.length > 0 && (
                <span className="text-sm font-normal text-content-tertiary">
                  {' '}
                  + {manualDebts.length} manual
                </span>
              )}
            </p>
          </div>
          <div className="card">
            <span className="card-title">AVG APR</span>
            <p className="text-2xl font-bold tabular-nums text-content-primary">
              {configuredDebts.length > 0
                ? (
                    configuredDebts.reduce((sum, d) => sum + d.apr, 0) / configuredDebts.length
                  ).toFixed(1)
                : '0.0'}
              %
            </p>
          </div>
        </div>
      )}

      {/* Account Selection */}
      {accountDebts.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="card-title">SELECT ACCOUNTS</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-accent-blue hover:underline">
                Select All
              </button>
              <span className="text-xs text-content-tertiary">|</span>
              <button onClick={selectNone} className="text-xs text-accent-blue hover:underline">
                None
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {accountDebts.map((debt) => {
              const isSelected = selectedAccountIds.has(debt.id);
              const aprPct = parseFloat(debt.apr) * 100;
              const needsConfig = aprPct === 0 || parseFloat(debt.minimumPayment) === 0;
              const profile = profiles.find((p) => p.accountId === debt.id);
              const isEditing = editingProfile === profile?.id;

              return (
                <div
                  key={debt.id}
                  className={`flex items-center gap-3 py-3 px-4 rounded-lg border transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'border-accent-blue/40 bg-accent-blue/5'
                      : 'border-edge hover:border-edge-hover'
                  }`}
                  onClick={() => !isEditing && toggleAccount(debt.id)}
                >
                  <div
                    className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                      isSelected ? 'bg-accent-blue border-accent-blue' : 'border-content-tertiary'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-red/10">
                    <Link2 size={14} className="text-accent-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary">{debt.name}</p>
                    {isEditing && profile ? (
                      <div
                        className="flex items-center gap-2 mt-1 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          step="0.01"
                          placeholder="APR %"
                          value={editValues.apr}
                          onChange={(e) => setEditValues({ ...editValues, apr: e.target.value })}
                          className="input w-20 text-xs py-1"
                        />
                        <span className="text-xs text-content-tertiary">%</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min $"
                          value={editValues.minimumPayment}
                          onChange={(e) =>
                            setEditValues({ ...editValues, minimumPayment: e.target.value })
                          }
                          className="input w-20 text-xs py-1"
                        />
                        <span className="text-xs text-content-tertiary">min</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Asset value"
                          value={editValues.assetValue}
                          onChange={(e) =>
                            setEditValues({ ...editValues, assetValue: e.target.value })
                          }
                          className="input w-28 text-xs py-1"
                          title="Value of the secured asset (home, vehicle)"
                        />
                        <span className="text-xs text-content-tertiary">asset</span>
                        <button
                          onClick={() => saveProfile(profile.id)}
                          disabled={updateProfileMutation.isPending}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingProfile(null)}
                          className="btn-ghost text-xs px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-content-tertiary">
                        {needsConfig ? (
                          <span className="text-accent-yellow">
                            Needs configuration
                            {profile && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(profile);
                                }}
                                className="ml-2 text-accent-blue hover:underline"
                              >
                                configure
                              </button>
                            )}
                          </span>
                        ) : (
                          <>
                            {aprPct.toFixed(1)}% APR · Min: $
                            {formatCurrency(parseFloat(debt.minimumPayment))}
                            {profile?.assetValue && (
                              <> · Asset: ${formatCurrency(parseFloat(profile.assetValue))}</>
                            )}
                            {profile && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(profile);
                                }}
                                className="ml-2 text-accent-blue hover:underline"
                              >
                                edit
                              </button>
                            )}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold tabular-nums text-accent-red">
                    ${formatCurrency(parseFloat(debt.balance))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual debts */}
      {manualDebts.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase text-content-tertiary tracking-wider">
            Manual / What-if
          </span>
          {manualDebts.map((d, i) => (
            <div
              key={i}
              className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-red/10">
                <CreditCard size={16} className="text-accent-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary">{d.name}</p>
                <p className="text-xs text-content-tertiary">
                  {d.apr}% APR · Min: ${formatCurrency(d.minimumPayment)}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums text-accent-red">
                ${formatCurrency(d.balance)}
              </p>
              <button
                onClick={() => removeManualDebt(i)}
                className="btn-ghost p-2 text-content-tertiary hover:text-accent-red"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Manual Debt Form */}
      <form onSubmit={addDebt} className="card space-y-4">
        <span className="card-title">ADD MANUAL DEBT</span>
        <p className="text-xs text-content-tertiary -mt-2">
          For what-if scenarios. Debts from your accounts are imported automatically.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="input-label">Name</label>
            <input
              placeholder="e.g. Visa Card"
              value={newDebt.name}
              onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="input-label">Balance</label>
            <input
              placeholder="0.00"
              type="number"
              step="0.01"
              value={newDebt.balance}
              onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="input-label">APR %</label>
            <input
              placeholder="0.00"
              type="number"
              step="0.01"
              value={newDebt.apr}
              onChange={(e) => setNewDebt({ ...newDebt, apr: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="input-label">Min Payment</label>
            <input
              placeholder="0.00"
              type="number"
              step="0.01"
              value={newDebt.minimumPayment}
              onChange={(e) => setNewDebt({ ...newDebt, minimumPayment: e.target.value })}
              className="input"
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          <Plus size={16} /> Add Debt
        </button>
      </form>

      {/* Calculate */}
      {configuredDebts.length > 0 && (
        <div className="card space-y-4">
          <span className="card-title">CALCULATE PAYOFF</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as 'snowball' | 'avalanche' | 'custom')}
                className="input"
              >
                <option value="avalanche">Avalanche (highest APR first)</option>
                <option value="snowball">Snowball (lowest balance first)</option>
                <option value="custom">Custom order</option>
              </select>
            </div>
            <div>
              <label className="input-label">Total Monthly Payment</label>
              <input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending}
                className="btn-primary"
              >
                <Calculator size={16} />{' '}
                {calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
              </button>
              <button
                onClick={() => compareMutation.mutate()}
                disabled={compareMutation.isPending}
                className="btn-secondary"
              >
                <BarChart3 size={16} /> Compare
              </button>
            </div>
          </div>
          {calculateMutation.isError && (
            <p className="text-sm text-accent-red">{calculateMutation.error.message}</p>
          )}
          {scheduleResult?.warning && (
            <p className="text-sm text-accent-yellow">{scheduleResult.warning}</p>
          )}
        </div>
      )}

      {/* Advanced Strategies */}
      {configuredDebts.length > 0 && (
        <div className="card space-y-4">
          <span className="card-title">EXPLORE STRATEGIES</span>
          <p className="text-xs text-content-tertiary -mt-2">
            Compare advanced payoff approaches against your current plan.
          </p>

          {/* Tab buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveTab('standard');
                baselineMutation.mutate();
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${activeTab === 'standard' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-edge text-content-secondary hover:border-edge-hover'}`}
            >
              <TrendingDown size={14} /> Minimum Only Baseline
            </button>
            <button
              onClick={() => setActiveTab('consolidation')}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${activeTab === 'consolidation' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-edge text-content-secondary hover:border-edge-hover'}`}
            >
              <Landmark size={14} /> Debt Consolidation
            </button>
            <button
              onClick={() => setActiveTab('velocity')}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${activeTab === 'velocity' ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-edge text-content-secondary hover:border-edge-hover'}`}
            >
              <Zap size={14} /> Velocity Banking
            </button>
          </div>

          {/* Minimum Only Baseline */}
          {activeTab === 'standard' && (
            <div className="space-y-3">
              <p className="text-sm text-content-secondary">
                Shows how long it takes to pay off all debts using only the minimum payments. No
                extra money applied.
              </p>
              <button
                onClick={() => baselineMutation.mutate()}
                disabled={baselineMutation.isPending}
                className="btn-secondary"
              >
                <Calculator size={14} />{' '}
                {baselineMutation.isPending ? 'Calculating...' : 'Calculate Baseline'}
              </button>
              {baselineResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                    <p className="text-xs text-content-tertiary uppercase">Time to Debt Free</p>
                    <p className="text-xl font-bold text-content-primary">
                      {baselineResult.totalMonths} months
                    </p>
                    <p className="text-xs text-content-tertiary">
                      {(baselineResult.totalMonths / 12).toFixed(1)} years
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                    <p className="text-xs text-content-tertiary uppercase">Total Interest Paid</p>
                    <p className="text-xl font-bold text-accent-red">
                      ${formatCurrency(parseFloat(baselineResult.totalInterest))}
                    </p>
                  </div>
                </div>
              )}
              {baselineResult?.warning && (
                <p className="text-sm text-accent-yellow">{baselineResult.warning}</p>
              )}
            </div>
          )}

          {/* Consolidation */}
          {activeTab === 'consolidation' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">
                Model refinancing all your debts into a single fixed-rate loan. Enter the terms
                you&apos;d qualify for to see if it saves money.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="input-label">New APR %</label>
                  <input
                    placeholder="7.99"
                    type="number"
                    step="0.01"
                    value={consolidationParams.newApr}
                    onChange={(e) =>
                      setConsolidationParams({ ...consolidationParams, newApr: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Term (months)</label>
                  <input
                    placeholder="60"
                    type="number"
                    step="1"
                    value={consolidationParams.termMonths}
                    onChange={(e) =>
                      setConsolidationParams({ ...consolidationParams, termMonths: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Origination Fee %</label>
                  <input
                    placeholder="0 (optional)"
                    type="number"
                    step="0.01"
                    value={consolidationParams.originationFee}
                    onChange={(e) =>
                      setConsolidationParams({
                        ...consolidationParams,
                        originationFee: e.target.value,
                      })
                    }
                    className="input"
                  />
                  <p className="text-[10px] text-content-tertiary mt-0.5">
                    One-time fee as % of balance
                  </p>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => consolidationMutation.mutate()}
                    disabled={consolidationMutation.isPending || !consolidationParams.newApr}
                    className="btn-primary w-full"
                  >
                    <Landmark size={14} />{' '}
                    {consolidationMutation.isPending ? 'Calculating...' : 'Calculate'}
                  </button>
                </div>
              </div>

              {consolidationMutation.isError && (
                <p className="text-sm text-accent-red">{consolidationMutation.error.message}</p>
              )}

              {consolidationResult && (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">Monthly Payment</p>
                      <p className="text-xl font-bold text-content-primary">
                        ${formatCurrency(parseFloat(consolidationResult.monthlyPayment))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">Total Interest</p>
                      <p className="text-xl font-bold text-accent-red">
                        ${formatCurrency(parseFloat(consolidationResult.totalInterest))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">
                        Total Cost (incl. fees)
                      </p>
                      <p className="text-xl font-bold text-content-primary">
                        ${formatCurrency(parseFloat(consolidationResult.totalCost))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">
                        vs. Minimum Payments
                      </p>
                      {parseFloat(consolidationResult.interestSavingsVsBaseline) > 0 ? (
                        <>
                          <p className="text-xl font-bold text-accent-green">
                            Save $
                            {formatCurrency(
                              parseFloat(consolidationResult.interestSavingsVsBaseline),
                            )}
                          </p>
                          <p className="text-xs text-accent-green">
                            {consolidationResult.timeSavingsVsBaseline} months faster
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-bold text-accent-red">
                            Costs $
                            {formatCurrency(
                              Math.abs(parseFloat(consolidationResult.interestSavingsVsBaseline)),
                            )}{' '}
                            more
                          </p>
                          <p className="text-xs text-accent-red">Not recommended</p>
                        </>
                      )}
                    </div>
                  </div>
                  {consolidationResult.warning && (
                    <p className="text-sm text-accent-yellow">{consolidationResult.warning}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Velocity Banking */}
          {activeTab === 'velocity' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">
                Uses a HELOC (or line of credit) to make lump-sum payments against your highest-rate
                debt. You then pay down the HELOC with your monthly disposable income and repeat the
                cycle.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="input-label">HELOC Limit</label>
                  <input
                    placeholder="10000"
                    type="number"
                    step="100"
                    value={velocityParams.helocLimit}
                    onChange={(e) =>
                      setVelocityParams({ ...velocityParams, helocLimit: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">HELOC APR %</label>
                  <input
                    placeholder="8.5"
                    type="number"
                    step="0.01"
                    value={velocityParams.helocApr}
                    onChange={(e) =>
                      setVelocityParams({ ...velocityParams, helocApr: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Monthly Disposable $</label>
                  <input
                    placeholder="1500"
                    type="number"
                    step="100"
                    value={velocityParams.monthlyDisposableIncome}
                    onChange={(e) =>
                      setVelocityParams({
                        ...velocityParams,
                        monthlyDisposableIncome: e.target.value,
                      })
                    }
                    className="input"
                  />
                  <p className="text-[10px] text-content-tertiary mt-0.5">
                    Income minus expenses (for HELOC paydown)
                  </p>
                </div>
                <div>
                  <label className="input-label">Chunk Amount</label>
                  <input
                    placeholder="5000"
                    type="number"
                    step="500"
                    value={velocityParams.chunkAmount}
                    onChange={(e) =>
                      setVelocityParams({ ...velocityParams, chunkAmount: e.target.value })
                    }
                    className="input"
                  />
                  <p className="text-[10px] text-content-tertiary mt-0.5">
                    Lump sum per cycle from HELOC
                  </p>
                </div>
              </div>
              <button
                onClick={() => velocityMutation.mutate()}
                disabled={
                  velocityMutation.isPending ||
                  !velocityParams.helocLimit ||
                  !velocityParams.helocApr ||
                  !velocityParams.monthlyDisposableIncome ||
                  !velocityParams.chunkAmount
                }
                className="btn-primary"
              >
                <Zap size={14} />{' '}
                {velocityMutation.isPending ? 'Calculating...' : 'Calculate Velocity Banking'}
              </button>

              {velocityMutation.isError && (
                <p className="text-sm text-accent-red">{velocityMutation.error.message}</p>
              )}

              {velocityResult && (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">Time to Debt Free</p>
                      <p className="text-xl font-bold text-content-primary">
                        {velocityResult.totalMonths} months
                      </p>
                      <p className="text-xs text-content-tertiary">
                        {(velocityResult.totalMonths / 12).toFixed(1)} years
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">Debt Interest</p>
                      <p className="text-xl font-bold text-accent-red">
                        ${formatCurrency(parseFloat(velocityResult.totalInterest))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">HELOC Interest</p>
                      <p className="text-xl font-bold text-content-primary">
                        ${formatCurrency(parseFloat(velocityResult.helocInterest))}
                      </p>
                      <p className="text-xs text-content-tertiary">
                        Combined: ${formatCurrency(parseFloat(velocityResult.combinedInterest))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated border border-edge">
                      <p className="text-xs text-content-tertiary uppercase">
                        vs. Minimum Payments
                      </p>
                      {parseFloat(velocityResult.interestSavingsVsBaseline) > 0 ? (
                        <>
                          <p className="text-xl font-bold text-accent-green">
                            Save $
                            {formatCurrency(parseFloat(velocityResult.interestSavingsVsBaseline))}
                          </p>
                          <p className="text-xs text-accent-green">
                            {velocityResult.timeSavingsVsBaseline} months faster
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-bold text-accent-red">
                            Costs $
                            {formatCurrency(
                              Math.abs(parseFloat(velocityResult.interestSavingsVsBaseline)),
                            )}{' '}
                            more
                          </p>
                          <p className="text-xs text-accent-red">HELOC rate may be too high</p>
                        </>
                      )}
                    </div>
                  </div>
                  {velocityResult.warning && (
                    <p className="text-sm text-accent-yellow">{velocityResult.warning}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compare Results */}
      {compareResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase text-content-tertiary tracking-wider">
                Strategy Comparison
              </span>
              {parseFloat(compareResult.interestSavings) > 0 && (
                <span className="text-xs text-accent-green bg-accent-green/10 px-2 py-0.5 rounded">
                  Save ${formatCurrency(parseFloat(compareResult.interestSavings))} ·{' '}
                  {compareResult.timeSavings} months faster
                </span>
              )}
            </div>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="btn-ghost flex items-center gap-1 text-sm text-accent-blue"
            >
              <Save size={14} /> Save Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {compareResult.strategies.map((s) => (
              <div key={s.strategy} className="card">
                <span className="card-title">{s.strategy.toUpperCase()}</span>
                <p className="text-lg font-bold tabular-nums text-content-primary">
                  {s.result.totalMonths} months
                </p>
                <p className="text-sm text-content-secondary tabular-nums">
                  ${formatCurrency(parseFloat(s.result.totalInterest))} total interest
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Results */}
      {scheduleResult &&
        scheduleResult.schedules.length > 0 &&
        (() => {
          // Build a consolidated month-by-month view
          const maxMonth = Math.min(scheduleResult.totalMonths, scheduleViewMax);
          const monthRows: Array<{
            month: number;
            entries: Array<{
              debtName: string;
              debtId: string;
              payment: string;
              interest: string;
              remainingBalance: string;
              paidOff: boolean;
            }>;
            totalPayment: number;
            totalInterest: number;
          }> = [];

          for (let m = 1; m <= maxMonth; m++) {
            const entries: (typeof monthRows)[number]['entries'] = [];
            let totalPayment = 0;
            let totalInterest = 0;

            for (const schedule of scheduleResult.schedules) {
              const row = schedule.months.find((r) => r.month === m);
              if (row) {
                const payment = parseFloat(row.payment);
                const interest = parseFloat(row.interest);
                const balance = parseFloat(row.remainingBalance);
                entries.push({
                  debtName: schedule.debtName,
                  debtId: schedule.debtId,
                  payment: row.payment,
                  interest: row.interest,
                  remainingBalance: row.remainingBalance,
                  paidOff: balance <= 0,
                });
                totalPayment += payment;
                totalInterest += interest;
              }
            }
            if (entries.length > 0) {
              monthRows.push({ month: m, entries, totalPayment, totalInterest });
            }
          }

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-content-tertiary tracking-wider">
                  Payoff Schedule
                </span>
                <div className="flex items-center gap-3">
                  <select
                    value={scheduleViewMax}
                    onChange={(e) => setScheduleViewMax(parseInt(e.target.value))}
                    className="input text-xs py-1 px-2 w-auto"
                  >
                    <option value={12}>12 months</option>
                    <option value={24}>24 months</option>
                    <option value={60}>60 months</option>
                    <option value={360}>All months</option>
                  </select>
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    className="btn-ghost flex items-center gap-1 text-sm text-accent-blue"
                  >
                    <Save size={14} /> Save Plan
                  </button>
                </div>
              </div>

              {/* Summary cards per debt */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scheduleResult.schedules.map((schedule) => (
                  <div key={schedule.debtId} className="card py-3 px-4">
                    <p className="text-sm font-medium text-content-primary">{schedule.debtName}</p>
                    <div className="flex items-baseline gap-4 mt-1">
                      <span className="text-xs text-content-tertiary">
                        Paid off:{' '}
                        <span className="text-accent-green font-medium">
                          Month {schedule.payoffMonth}
                        </span>
                      </span>
                      <span className="text-xs text-content-tertiary">
                        Interest:{' '}
                        <span className="text-accent-red font-medium">
                          ${formatCurrency(parseFloat(schedule.totalInterest))}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div className="card py-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-content-tertiary uppercase">Debt Free In</p>
                    <p className="text-lg font-bold text-content-primary">
                      {scheduleResult.totalMonths} months
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary uppercase">Total Interest</p>
                    <p className="text-lg font-bold text-accent-red">
                      ${formatCurrency(parseFloat(scheduleResult.totalInterest))}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-content-tertiary">
                  Strategy:{' '}
                  <span className="capitalize font-medium text-content-secondary">{strategy}</span>
                </div>
              </div>

              {/* Consolidated month-by-month table */}
              <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-edge">
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase">
                          Month
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase">
                          Debt
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                          Payment
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                          Interest
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase text-right">
                          Balance
                        </th>
                        <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.map((monthRow) => (
                        <React.Fragment key={monthRow.month}>
                          {monthRow.entries.map((entry, i) => (
                            <tr
                              key={`${monthRow.month}-${entry.debtId}`}
                              className={`hover:bg-surface-elevated transition-colors ${i === 0 ? 'border-t border-edge' : ''} ${entry.paidOff ? 'bg-accent-green/5' : ''}`}
                            >
                              {i === 0 ? (
                                <td
                                  className="px-4 py-2 text-content-primary tabular-nums font-medium"
                                  rowSpan={monthRow.entries.length}
                                >
                                  {monthRow.month}
                                </td>
                              ) : null}
                              <td className="px-4 py-2 text-content-secondary text-xs">
                                {entry.debtName}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-content-primary">
                                ${formatCurrency(parseFloat(entry.payment))}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-accent-red">
                                ${formatCurrency(parseFloat(entry.interest))}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-content-primary">
                                ${formatCurrency(parseFloat(entry.remainingBalance))}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {entry.paidOff ? (
                                  <span className="text-xs bg-accent-green/10 text-accent-green px-2 py-0.5 rounded font-medium">
                                    Paid Off
                                  </span>
                                ) : (
                                  <span className="text-xs text-content-tertiary">Active</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Month total row */}
                          <tr className="bg-surface-elevated/50">
                            <td className="px-4 py-1"></td>
                            <td className="px-4 py-1 text-xs text-content-tertiary font-medium">
                              Month Total
                            </td>
                            <td className="px-4 py-1 text-right tabular-nums text-xs font-medium text-content-secondary">
                              ${formatCurrency(monthRow.totalPayment)}
                            </td>
                            <td className="px-4 py-1 text-right tabular-nums text-xs text-accent-red/70">
                              ${formatCurrency(monthRow.totalInterest)}
                            </td>
                            <td className="px-4 py-1" colSpan={2}></td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Save Plan Dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowSaveDialog(false)}
        >
          <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <span className="card-title">SAVE PAYOFF PLAN</span>
            <p className="text-sm text-content-secondary">
              Save this combination of {selectedAccountIds.size} accounts with {strategy} strategy
              and ${formatCurrency(parseFloat(monthlyPayment) || 0)}/mo payment.
            </p>
            <div>
              <label className="input-label">Plan Name</label>
              <input
                placeholder="e.g. Aggressive CC payoff"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="input"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSaveDialog(false)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={!planName.trim() || savePlanMutation.isPending}
                className="btn-primary"
              >
                <Save size={14} /> {savePlanMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Plans */}
      {savedPlans.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-medium uppercase text-content-tertiary tracking-wider flex items-center gap-2">
            <BookMarked size={14} /> Saved Plans
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedPlans.map((plan) => (
              <div
                key={plan.id}
                className="card space-y-2 hover:border-edge-hover transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-content-primary">{plan.name}</p>
                    <p className="text-xs text-content-tertiary capitalize">
                      {plan.strategy} · {plan.accountIds.length} accounts
                    </p>
                  </div>
                  <button
                    onClick={() => deletePlanMutation.mutate(plan.id)}
                    className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                    title="Delete plan"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-content-primary">
                      {plan.totalMonths}{' '}
                      <span className="text-xs font-normal text-content-tertiary">months</span>
                    </p>
                    <p className="text-xs text-content-secondary tabular-nums">
                      ${formatCurrency(parseFloat(plan.totalInterest))} interest
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-content-tertiary">
                      ${formatCurrency(parseFloat(plan.totalMonthlyPayment))}/mo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => loadPlan(plan)}
                  className="btn-ghost text-xs w-full text-accent-blue mt-1"
                >
                  Load this plan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {accountDebts.length === 0 && manualDebts.length === 0 && !isLoading && (
        <div className="card text-center py-12">
          <CreditCard size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary text-sm">No debts found</p>
          <p className="text-content-tertiary text-xs mt-1">
            Add a credit card, loan, or mortgage account and it will appear here automatically. You
            can also add debts manually for what-if scenarios.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-8">
          <RefreshCw size={24} className="mx-auto text-content-tertiary mb-2 animate-spin" />
          <p className="text-content-secondary text-sm">Loading debts from accounts...</p>
        </div>
      )}
    </div>
  );
}
