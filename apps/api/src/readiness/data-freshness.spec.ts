import { describe, expect, it } from 'vitest';
import { summarizeDataFreshness } from './data-freshness';

const now = new Date('2026-08-22T12:00:00.000Z');

describe('summarizeDataFreshness', () => {
  it('reports manual accounts separately without calling them stale', () => {
    const summary = summarizeDataFreshness([{ linkedSyncTimes: [] }], now);

    expect(summary).toMatchObject({ manualAccounts: 1, synchronizedAccounts: 0, staleAccounts: 0 });
  });

  it('marks only overdue or never-completed connected accounts as stale', () => {
    const summary = summarizeDataFreshness(
      [
        { linkedSyncTimes: [new Date('2026-08-14T11:59:59.000Z')] },
        { linkedSyncTimes: [new Date('2026-08-21T12:00:00.000Z')] },
        { linkedSyncTimes: [null] },
      ],
      now,
    );

    expect(summary).toMatchObject({ synchronizedAccounts: 3, manualAccounts: 0, staleAccounts: 2 });
  });

  it('returns the most recent successful synchronization time', () => {
    const summary = summarizeDataFreshness(
      [
        { linkedSyncTimes: [new Date('2026-08-20T12:00:00.000Z')] },
        { linkedSyncTimes: [new Date('2026-08-21T12:00:00.000Z')] },
      ],
      now,
    );

    expect(summary.lastSynchronizedAt).toEqual(new Date('2026-08-21T12:00:00.000Z'));
  });
});
