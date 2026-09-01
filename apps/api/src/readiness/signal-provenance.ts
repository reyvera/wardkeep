import { Signal } from '@wardkeep/readiness';
import { DataFreshnessByScope, DataFreshnessSummary } from './data-freshness';

export type EvidenceState =
  'synchronized' | 'manual' | 'mixed' | 'stale' | 'calculated' | 'unknown';

export interface SignalProvenance {
  sources: string[];
  method: string;
  limitation: string;
  evidenceState: EvidenceState;
}

const PROVENANCE_BY_CAPABILITY: Record<string, SignalProvenance> = {
  'emergency-fund': {
    sources: ['Liquid account balances', 'Recent debit transactions'],
    method: 'Compares liquid reserves with a filtered ordinary-expense burn rate.',
    limitation: 'This measures cash resilience only; it is not a complete Protection assessment.',
    evidenceState: 'calculated',
  },
  insurance: {
    sources: ['User-entered active insurance policies'],
    method: 'Checks recorded renewal dates and policy-record presence.',
    limitation: 'Wardkeep does not yet assess policy limits, affordability, or coverage adequacy.',
    evidenceState: 'manual',
  },
  'insurance-deductibles': {
    sources: ['User-entered policy deductibles', 'Liquid account balances'],
    method: 'Compares the sum of recorded deductibles with current liquid reserves.',
    limitation: 'Unrecorded deductibles and worst-case simultaneous losses are not assumed.',
    evidenceState: 'mixed',
  },
  'insurance-record-details': {
    sources: ['User-entered active insurance policies'],
    method: 'Checks whether each entered policy includes a renewal date, deductible, and coverage amount.',
    limitation: 'Complete records do not prove insurance adequacy; unentered policy types remain unknown.',
    evidenceState: 'manual',
  },
  'insurance-coverage-target': {
    sources: ['User-entered policy coverage amount', 'User-entered coverage target'],
    method: 'Flags when a recorded policy amount is below the household-entered target.',
    limitation:
      'Wardkeep does not determine whether a target or policy amount is adequate, available, or payable.',
    evidenceState: 'manual',
  },
  'estate-documents': {
    sources: ['User-entered estate-planning records'],
    method: 'Checks recorded document review dates and record presence.',
    limitation: 'Wardkeep does not assess legal validity, beneficiary choices, document access, or adequacy.',
    evidenceState: 'manual',
  },
  'income-sources': { sources: ['User-entered income-source records'], method: 'Checks recorded income-context review dates and record presence.', limitation: 'Wardkeep does not infer job security, payment continuity, or income interruption resilience.', evidenceState: 'manual' },
  'secondary-liquidity': { sources: ['Credit-card limits', 'Current account balances'], method: 'Warns only when a recorded card has 10% or less of its limit available.', limitation: 'Available credit is borrowing capacity, not cash; it never increases emergency-fund coverage.', evidenceState: 'mixed' },
  'fixed-obligations': { sources: ['Recorded debt profiles', 'Confirmed recurring bills', 'Entered external commitments', 'Liquid account balances'], method: 'Compares recorded monthly commitments with liquid reserves.', limitation: 'External commitments are entered estimates; tracked expenses must not be entered again, and unrecorded bills and income are not included.', evidenceState: 'mixed' },
  dependents: { sources: ['User-entered dependent records'], method: 'Checks household-planning review dates and record presence.', limitation: 'Wardkeep does not assess care needs, coverage adequacy, or financial responsibility.', evidenceState: 'manual' },
  'planned-expenses': { sources: ['User-entered planned expenses', 'Recorded amounts and funds set aside'], method: 'Compares a recorded near-term expense with only the amount explicitly marked as set aside.', limitation: 'Wardkeep does not infer affordability, account availability, or unrecorded future costs.', evidenceState: 'manual' },
  'vehicle-maintenance': { sources: ['User-entered vehicle maintenance records'], method: 'Flags recorded maintenance dates that are due or overdue.', limitation: 'Wardkeep does not infer maintenance requirements, cost, or vehicle safety.', evidenceState: 'manual' },
  'vehicle-lease': { sources: ['User-entered vehicle lease end dates'], method: 'Flags recorded leases ending in the next 90 days.', limitation: 'Wardkeep does not infer a replacement cost, buyout option, or financing eligibility.', evidenceState: 'manual' },
  'home-assets': { sources: ['User-entered home asset installation and lifespan records'], method: 'Flags an entered asset near or beyond its recorded expected lifespan.', limitation: 'Expected lifespan and replacement cost are planning inputs, not a prediction of failure.', evidenceState: 'manual' },
  budgets: {
    sources: ['Current-month budget allocations', 'Current-month debit transactions'],
    method: 'Compares actual spending and budget pace with the current allocation.',
    limitation: 'Uncategorized or missing transactions can make the pace incomplete.',
    evidenceState: 'calculated',
  },
  cashflow: {
    sources: ['Account balances', 'Recurring transactions'],
    method: 'Projects account balances over the next 30 days.',
    limitation:
      'The projection includes recorded recurring items, not unrecorded future spending or income.',
    evidenceState: 'mixed',
  },
  recurring: {
    sources: ['Upcoming recurring transactions', 'Liquid account balances'],
    method: 'Compares upcoming 14-day recurring bills with liquid funds.',
    limitation: 'Only recurring items Wardkeep has recorded are included.',
    evidenceState: 'mixed',
  },
  accounts: {
    sources: ['Account balances', 'Account transactions', 'Dated manual property valuations', 'Readiness snapshots'],
    method: 'Calculates net-worth position and compares it with available history.',
    limitation: 'Property values are dated manual inputs; asset values and historical snapshots are limited to records in Wardkeep.',
    evidenceState: 'calculated',
  },
  debt: {
    sources: ['Debt accounts', 'Recent credit transactions', 'Saved debt payoff plans'],
    method: 'Evaluates debt position, payment burden, and recorded payoff progress.',
    limitation: 'Income and debt data not recorded in Wardkeep are not included.',
    evidenceState: 'calculated',
  },
};

const FALLBACK_PROVENANCE: SignalProvenance = {
  sources: ['Current Wardkeep records'],
  method: 'Derives an explainable readiness signal from available data.',
  limitation: 'Coverage is limited to the records Wardkeep can currently evaluate.',
  evidenceState: 'unknown',
};

const ACCOUNT_EVIDENCE_CAPABILITIES = new Set([
  'emergency-fund',
  'insurance-deductibles',
  'budgets',
  'cashflow',
  'recurring',
  'accounts',
  'debt',
]);

const LIQUID_ACCOUNT_CAPABILITIES = new Set([
  'emergency-fund',
  'insurance-deductibles',
  'fixed-obligations',
  'recurring',
]);

const DEBT_ACCOUNT_CAPABILITIES = new Set(['debt']);

function freshnessForSignal(
  signal: Signal,
  freshness: DataFreshnessSummary | DataFreshnessByScope,
): DataFreshnessSummary {
  if (!('all' in freshness)) return freshness;
  if (LIQUID_ACCOUNT_CAPABILITIES.has(signal.capabilityId)) return freshness.liquid;
  if (DEBT_ACCOUNT_CAPABILITIES.has(signal.capabilityId)) return freshness.debt;
  return freshness.all;
}

function evidenceStateFor(
  signal: Signal,
  freshness?: DataFreshnessSummary | DataFreshnessByScope,
): EvidenceState {
  const base = (PROVENANCE_BY_CAPABILITY[signal.capabilityId] ?? FALLBACK_PROVENANCE).evidenceState;
  if (!freshness || !ACCOUNT_EVIDENCE_CAPABILITIES.has(signal.capabilityId)) return base;
  const signalFreshness = freshnessForSignal(signal, freshness);
  if (signalFreshness.staleAccounts > 0) return 'stale';
  if (signalFreshness.synchronizedAccounts > 0 && signalFreshness.manualAccounts > 0) return 'mixed';
  if (signalFreshness.synchronizedAccounts > 0) return 'synchronized';
  if (signalFreshness.manualAccounts > 0) return 'manual';
  return base;
}

/** Adds user-visible evidence context without changing a signal's score. */
export function withSignalProvenance(
  signal: Signal,
  freshness?: DataFreshnessSummary | DataFreshnessByScope,
): Signal & { provenance: SignalProvenance } {
  const provenance = PROVENANCE_BY_CAPABILITY[signal.capabilityId] ?? FALLBACK_PROVENANCE;
  return {
    ...signal,
    provenance: { ...provenance, evidenceState: evidenceStateFor(signal, freshness) },
  };
}
