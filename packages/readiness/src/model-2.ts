import type { ReadinessPillar, Signal } from './types';

/** Published direct weights for the four-pillar readiness model. Peace is derived. */
export const MODEL_2_PILLAR_WEIGHTS = {
  protection: 0.35,
  provision: 0.35,
  prosperity: 0.3,
} as const;

/** Reclassifies transitional Preparation capabilities by their household consequence. */
export const MODEL_2_PILLAR_BY_CAPABILITY: Record<string, ReadinessPillar> = {
  'planned-expenses': 'provision',
  'vehicle-lease': 'provision',
  'home-assets': 'protection',
  'vehicle-maintenance': 'peace',
};

/** Returns a copy of a signal with its model-2 pillar when that capability is reclassified. */
export function reclassifySignalForModel2(
  signal: Signal,
): Omit<Signal, 'pillar'> & { pillar: ReadinessPillar } {
  const pillar = MODEL_2_PILLAR_BY_CAPABILITY[signal.capabilityId];
  return pillar ? { ...signal, pillar } : signal;
}

export function reclassifySignalsForModel2(
  signals: readonly Signal[],
): Array<Omit<Signal, 'pillar'> & { pillar: ReadinessPillar }> {
  return signals.map(reclassifySignalForModel2);
}
