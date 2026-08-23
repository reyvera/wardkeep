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
});
