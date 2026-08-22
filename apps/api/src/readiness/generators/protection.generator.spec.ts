import { describe, expect, it } from 'vitest';
import { insuranceRenewalSignal } from './protection.generator';

const now = new Date('2026-08-22T12:00:00.000Z');

describe('insuranceRenewalSignal', () => {
  it('warns when an entered policy renews within 30 days', () => {
    const signal = insuranceRenewalSignal(
      { type: 'AUTO', provider: 'State Farm', renewalDate: new Date('2026-09-05T00:00:00.000Z') },
      now,
    );
    expect(signal).toMatchObject({ type: 'warning', magnitude: -3, capabilityId: 'insurance' });
    expect(signal?.summary).toContain('14 days');
  });

  it('flags a recorded renewal date that has passed', () => {
    const signal = insuranceRenewalSignal(
      { type: 'HOME', provider: 'Travelers', renewalDate: new Date('2026-08-20T00:00:00.000Z') },
      now,
    );
    expect(signal).toMatchObject({ type: 'risk', magnitude: -6 });
  });

  it('does not infer a renewal concern when no date is recorded or it is distant', () => {
    expect(
      insuranceRenewalSignal({ type: 'LIFE', provider: 'Example', renewalDate: null }, now),
    ).toBeNull();
    expect(
      insuranceRenewalSignal(
        { type: 'LIFE', provider: 'Example', renewalDate: new Date('2026-10-01T00:00:00.000Z') },
        now,
      ),
    ).toBeNull();
  });
});
