import { PillarScores, ReadinessSnapshot } from '@wardkeep/readiness';

export type PillarTrendDirection = 'improving' | 'declining' | 'steady' | 'not_enough_history';

export interface PillarTrend {
  direction: PillarTrendDirection;
  label: string;
  delta: number | null;
  comparedTo: Date | null;
  elapsedDays: number | null;
}

/**
 * Labels each pillar only when Wardkeep has a recorded comparison at least a
 * week old. A small two-point band avoids presenting ordinary score noise as a
 * household trend.
 */
export function buildPillarTrends(
  current: PillarScores,
  snapshots: readonly ReadinessSnapshot[],
  evaluatedAt: Date,
): Record<keyof PillarScores, PillarTrend> {
  const cutoff = new Date(evaluatedAt);
  cutoff.setDate(cutoff.getDate() - 7);
  const comparison = snapshots.find((snapshot) => snapshot.recordedAt <= cutoff);

  return Object.fromEntries(
    (Object.keys(current) as Array<keyof PillarScores>).map((pillar) => {
      if (!comparison) {
        return [
          pillar,
          {
            direction: 'not_enough_history',
            label: 'More recorded history needed',
            delta: null,
            comparedTo: null,
            elapsedDays: null,
          },
        ];
      }

      const delta = current[pillar] - comparison.pillars[pillar];
      const direction: PillarTrendDirection =
        delta >= 2 ? 'improving' : delta <= -2 ? 'declining' : 'steady';
      return [
        pillar,
        {
          direction,
          label:
            direction === 'improving'
              ? 'Improving'
              : direction === 'declining'
                ? 'Declining'
                : 'Holding steady',
          delta,
          comparedTo: comparison.recordedAt,
          elapsedDays: Math.max(
            1,
            Math.round((evaluatedAt.getTime() - comparison.recordedAt.getTime()) / 86_400_000),
          ),
        },
      ];
    }),
  ) as Record<keyof PillarScores, PillarTrend>;
}
