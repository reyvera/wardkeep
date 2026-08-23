import { Signal } from '@wardkeep/readiness';
import { DataFreshnessSummary } from './data-freshness';

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
  'estate-documents': {
    sources: ['User-entered estate-planning records'],
    method: 'Checks recorded document review dates and record presence.',
    limitation: 'Wardkeep does not assess legal validity, beneficiary choices, document access, or adequacy.',
    evidenceState: 'manual',
  },
  'income-sources': { sources: ['User-entered income-source records'], method: 'Checks recorded income-context review dates and record presence.', limitation: 'Wardkeep does not infer job security, payment continuity, or income interruption resilience.', evidenceState: 'manual' },
  'secondary-liquidity': { sources: ['Credit-card limits', 'Current account balances'], method: 'Warns only when a recorded card has 10% or less of its limit available.', limitation: 'Available credit is borrowing capacity, not cash; it never increases emergency-fund coverage.', evidenceState: 'mixed' },
  'fixed-obligations': { sources: ['Recorded debt profiles', 'Liquid account balances'], method: 'Compares recorded monthly debt minimums with liquid reserves.', limitation: 'Unrecorded bills, variable obligations, and income are not included.', evidenceState: 'mixed' },
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
    sources: ['Account balances', 'Account transactions', 'Readiness snapshots'],
    method: 'Calculates net-worth position and compares it with available history.',
    limitation: 'Asset values and historical snapshots are limited to records in Wardkeep.',
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

function evidenceStateFor(signal: Signal, freshness?: DataFreshnessSummary): EvidenceState {
  const base = (PROVENANCE_BY_CAPABILITY[signal.capabilityId] ?? FALLBACK_PROVENANCE).evidenceState;
  if (!freshness || !ACCOUNT_EVIDENCE_CAPABILITIES.has(signal.capabilityId)) return base;
  if (freshness.staleAccounts > 0) return 'stale';
  if (freshness.synchronizedAccounts > 0 && freshness.manualAccounts > 0) return 'mixed';
  if (freshness.synchronizedAccounts > 0) return 'synchronized';
  if (freshness.manualAccounts > 0) return 'manual';
  return base;
}

/** Adds user-visible evidence context without changing a signal's score. */
export function withSignalProvenance(
  signal: Signal,
  freshness?: DataFreshnessSummary,
): Signal & { provenance: SignalProvenance } {
  const provenance = PROVENANCE_BY_CAPABILITY[signal.capabilityId] ?? FALLBACK_PROVENANCE;
  return {
    ...signal,
    provenance: { ...provenance, evidenceState: evidenceStateFor(signal, freshness) },
  };
}
