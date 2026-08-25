export interface AccountFreshnessInput {
  linkedSyncTimes: Array<Date | null>;
  type?: string;
}

export interface DataFreshnessSummary {
  synchronizedAccounts: number;
  manualAccounts: number;
  staleAccounts: number;
  lastSynchronizedAt: Date | null;
}

export interface DataFreshnessByScope {
  all: DataFreshnessSummary;
  liquid: DataFreshnessSummary;
  debt: DataFreshnessSummary;
}

export const STALE_SYNC_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const LIQUID_ACCOUNT_TYPES = new Set(['CHECKING', 'SAVINGS', 'CASH']);
const DEBT_ACCOUNT_TYPES = new Set(['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC']);

/**
 * Summarizes freshness without treating manually maintained records as failed bank syncs.
 * A linked account with no completed sync is considered stale; manual accounts are reported
 * separately because Wardkeep cannot infer when a person last verified their balance.
 */
export function summarizeDataFreshness(
  accounts: readonly AccountFreshnessInput[],
  now = new Date(),
): DataFreshnessSummary {
  const synchronized = accounts.filter((account) => account.linkedSyncTimes.length > 0);
  const syncTimes = synchronized
    .flatMap((account) => account.linkedSyncTimes)
    .filter((date): date is Date => date !== null);
  const lastSynchronizedAt = syncTimes.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const staleAccounts = synchronized.filter((account) => {
    const latestSync = account.linkedSyncTimes
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latestSync === undefined || now.getTime() - latestSync.getTime() > STALE_SYNC_AFTER_MS;
  }).length;

  return {
    synchronizedAccounts: synchronized.length,
    manualAccounts: accounts.length - synchronized.length,
    staleAccounts,
    lastSynchronizedAt,
  };
}
