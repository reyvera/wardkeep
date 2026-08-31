import { PillarScores, ReadinessPillar, Signal } from '@wardkeep/readiness';

type DirectPillar = Exclude<ReadinessPillar, 'peace'>;

export interface SnapshotSignal {
  capabilityId: string;
  type: string;
  magnitude: number;
  pillar: string;
  summary: string;
}

export interface DurableReadinessChange {
  pillar: ReadinessPillar;
  previous: number;
  current: number;
  delta: number;
  reason: string;
  evidence: {
    added: string[];
    resolved: string[];
  };
}

function signalKey(signal: SnapshotSignal): string {
  return [signal.capabilityId, signal.type.toLowerCase(), signal.magnitude, signal.summary].join(
    '|',
  );
}

/**
 * Produces a concise, persisted explanation for every changed readiness pillar.
 * This is deliberately deterministic: it compares the exact signal evidence saved
 * with the preceding snapshot and never invents an explanation from an AI model.
 */
export function deriveDurableReadinessChanges(
  previous: PillarScores,
  current: PillarScores,
  previousSignals: readonly SnapshotSignal[],
  currentSignals: readonly Signal[],
): DurableReadinessChange[] {
  return (Object.keys(current) as ReadinessPillar[])
    .filter((pillar) => previous[pillar] !== current[pillar])
    .map((pillar) => {
      const delta = current[pillar] - previous[pillar];
      if (pillar === 'peace') {
        return {
          pillar,
          previous: previous[pillar],
          current: current[pillar],
          delta,
          reason: `Peace changed from ${previous[pillar]} to ${current[pillar]} because its derived stability score changed with the observed direct-pillar scores or their recent variability.`,
          evidence: { added: [], resolved: [] },
        };
      }

      const prior = previousSignals.filter((signal) => signal.pillar.toLowerCase() === pillar);
      const next = currentSignals.filter((signal) => signal.pillar === pillar);
      const priorKeys = new Set(prior.map(signalKey));
      const nextKeys = new Set(next.map(signalKey));
      const added = next
        .filter((signal) => !priorKeys.has(signalKey(signal)))
        .map((signal) => signal.summary);
      const resolved = prior
        .filter((signal) => !nextKeys.has(signalKey(signal)))
        .map((signal) => signal.summary);
      const evidence = { added: added.slice(0, 3), resolved: resolved.slice(0, 3) };
      const details = [
        evidence.added.length ? `new evidence: ${evidence.added.join('; ')}` : '',
        evidence.resolved.length ? `resolved evidence: ${evidence.resolved.join('; ')}` : '',
      ].filter(Boolean);

      return {
        pillar,
        previous: previous[pillar],
        current: current[pillar],
        delta,
        reason:
          details.length > 0
            ? `${pillar[0].toUpperCase()}${pillar.slice(1)} changed from ${previous[pillar]} to ${current[pillar]} because its recorded evidence changed (${details.join('. ')}).`
            : `${pillar[0].toUpperCase()}${pillar.slice(1)} changed from ${previous[pillar]} to ${current[pillar]}; the score changed without a persisted signal-level difference.`,
        evidence,
      };
    });
}
