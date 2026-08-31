import { describe, expect, it } from 'vitest';

import { deriveDurableReadinessChanges } from './readiness-change';

describe('deriveDurableReadinessChanges', () => {
  it('persists signal evidence for a changed direct pillar', () => {
    const changes = deriveDurableReadinessChanges(
      { protection: 60, provision: 70, preparation: 50, prosperity: 80, peace: 65 },
      { protection: 72, provision: 70, preparation: 50, prosperity: 80, peace: 68 },
      [
        {
          capabilityId: 'finance',
          type: 'risk',
          magnitude: -5,
          pillar: 'protection',
          summary: 'Liquid reserves cover one month.',
        },
      ],
      [
        {
          capabilityId: 'finance',
          type: 'positive',
          magnitude: 2,
          pillar: 'protection',
          summary: 'Liquid reserves cover three months.',
        },
      ],
    );

    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      pillar: 'protection',
      previous: 60,
      current: 72,
      delta: 12,
    });
    expect(changes[0].reason).toContain('Liquid reserves cover three months.');
    expect(changes[0].evidence).toEqual({
      added: ['Liquid reserves cover three months.'],
      resolved: ['Liquid reserves cover one month.'],
    });
    expect(changes[1].reason).toContain('derived stability score');
  });
});
