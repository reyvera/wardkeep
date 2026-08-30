import type { Signal } from './types';

/** The next published scoring contract. It is not active until the API cutover ships. */
export const MODEL_2_VERSION = 2;

/** Model 2 has three directly scored areas. Peace is shown separately as a summary. */
export const MODEL_2_DIRECT_PILLARS = ['protection', 'provision', 'prosperity'] as const;

export type Model2DirectPillar = (typeof MODEL_2_DIRECT_PILLARS)[number];
export type Model2Pillar = Model2DirectPillar | 'peace';

/** Published direct weights for Model 2. Peace is derived, not part of the overall score. */
export const MODEL_2_PILLAR_WEIGHTS = {
  protection: 0.35,
  provision: 0.35,
  prosperity: 0.3,
} as const;

/** Reclassifies transitional Preparation capabilities by their household consequence. */
export const MODEL_2_PILLAR_BY_CAPABILITY: Record<string, Model2Pillar> = {
  'planned-expenses': 'provision',
  'vehicle-lease': 'provision',
  'home-assets': 'protection',
  'vehicle-maintenance': 'peace',
};

/** Returns a copy of a signal with its model-2 pillar when that capability is reclassified. */
export function reclassifySignalForModel2(
  signal: Signal,
): Omit<Signal, 'pillar'> & { pillar: Model2Pillar } {
  const pillar = MODEL_2_PILLAR_BY_CAPABILITY[signal.capabilityId];
  if (pillar) return { ...signal, pillar };
  if (signal.pillar === 'preparation') {
    throw new Error(`Model 2 requires a pillar mapping for ${signal.capabilityId}`);
  }
  return { ...signal, pillar: signal.pillar as Model2DirectPillar };
}

export function reclassifySignalsForModel2(
  signals: readonly Signal[],
): Array<Omit<Signal, 'pillar'> & { pillar: Model2Pillar }> {
  return signals.map(reclassifySignalForModel2);
}
