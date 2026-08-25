import { describe, expect, it } from 'vitest';

import { withSignalProvenance } from './signal-provenance';

describe('withSignalProvenance', () => {
  it('explains the evidence and limit for an insurance signal', () => {
    const signal = withSignalProvenance({
      capabilityId: 'insurance',
      type: 'warning',
      magnitude: -3,
      pillar: 'protection',
      summary: 'Example renewal is approaching.',
    });

    expect(signal.provenance).toMatchObject({
      sources: ['User-entered active insurance policies'],
    });
    expect(signal.provenance.limitation).toContain('does not yet assess');
  });

  it('provides an honest generic limitation for a future capability', () => {
    const signal = withSignalProvenance({
      capabilityId: 'future-capability',
      type: 'opportunity',
      magnitude: 1,
      pillar: 'protection',
      summary: 'Future signal.',
    });

    expect(signal.provenance.sources).toEqual(['Current Wardkeep records']);
    expect(signal.provenance.limitation).toContain('currently evaluate');
  });

  it('marks account-derived evidence stale when a connected account needs review', () => {
    const signal = withSignalProvenance(
      {
        capabilityId: 'emergency-fund',
        type: 'warning',
        magnitude: -4,
        pillar: 'protection',
        summary: 'Example reserves.',
      },
      { synchronizedAccounts: 1, manualAccounts: 0, staleAccounts: 1, lastSynchronizedAt: null },
    );

    expect(signal.provenance.evidenceState).toBe('stale');
  });

  it('uses the freshness scope relevant to the signal', () => {
    const freshness = {
      all: { synchronizedAccounts: 2, manualAccounts: 0, staleAccounts: 1, lastSynchronizedAt: null },
      liquid: { synchronizedAccounts: 1, manualAccounts: 0, staleAccounts: 0, lastSynchronizedAt: null },
      debt: { synchronizedAccounts: 1, manualAccounts: 0, staleAccounts: 1, lastSynchronizedAt: null },
    };

    expect(
      withSignalProvenance(
        { capabilityId: 'emergency-fund', type: 'warning', magnitude: -4, pillar: 'protection', summary: 'Example reserves.' },
        freshness,
      ).provenance.evidenceState,
    ).toBe('synchronized');
    expect(
      withSignalProvenance(
        { capabilityId: 'debt', type: 'warning', magnitude: -4, pillar: 'prosperity', summary: 'Example debt.' },
        freshness,
      ).provenance.evidenceState,
    ).toBe('stale');
  });

  it('identifies insurance records as manual evidence', () => {
    const signal = withSignalProvenance({
      capabilityId: 'insurance',
      type: 'positive',
      magnitude: 1,
      pillar: 'protection',
      summary: 'Example policy.',
    });

    expect(signal.provenance.evidenceState).toBe('manual');
  });
});
