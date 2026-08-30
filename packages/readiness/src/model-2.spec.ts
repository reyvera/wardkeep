import { describe, expect, it } from 'vitest';

import { MODEL_2_PILLAR_BY_CAPABILITY, MODEL_2_PILLAR_WEIGHTS, reclassifySignalForModel2, reclassifySignalsForModel2 } from './model-2';

describe('model 2 readiness contract', () => {
  it('publishes direct weights that total one', () => {
    expect(Object.values(MODEL_2_PILLAR_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(1);
  });

  it('reclassifies a generated signal set consistently', () => {
    const results = reclassifySignalsForModel2([
      { capabilityId: 'vehicle-lease', type: 'warning', magnitude: -2, pillar: 'preparation', summary: 'Lease ending.' },
      { capabilityId: 'home-assets', type: 'warning', magnitude: -2, pillar: 'preparation', summary: 'Asset aging.' },
    ]);

    expect(results.map((signal) => signal.pillar)).toEqual(['provision', 'protection']);
  });

  it('reclassifies transitional capabilities by household consequence', () => {
    expect(MODEL_2_PILLAR_BY_CAPABILITY).toMatchObject({
      'planned-expenses': 'provision',
      'vehicle-lease': 'provision',
      'home-assets': 'protection',
      'vehicle-maintenance': 'peace',
    });
  });

  it('returns a reclassified signal without mutating the original', () => {
    const signal = { capabilityId: 'planned-expenses', type: 'warning' as const, magnitude: -3, pillar: 'preparation' as const, summary: 'Property tax due.' };
    const result = reclassifySignalForModel2(signal);

    expect(result).toMatchObject({ pillar: 'provision' });
    expect(signal.pillar).toBe('preparation');
  });
});
