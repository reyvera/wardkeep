import { describe, expect, it } from 'vitest';

import { buildPillarTrends } from './readiness-trends';

describe('buildPillarTrends', () => {
  const scores = { protection: 72, provision: 70, preparation: 50, prosperity: 80, peace: 68 };

  it('labels a recorded pillar comparison without treating small changes as a trend', () => {
    const trends = buildPillarTrends(
      scores,
      [
        {
          overall: 60,
          pillars: { protection: 68, provision: 71, preparation: 50, prosperity: 80, peace: 65 },
          recordedAt: new Date('2026-08-20T00:00:00.000Z'),
          modelVersion: 1,
        },
      ],
      new Date('2026-08-30T00:00:00.000Z'),
    );

    expect(trends.protection).toMatchObject({
      direction: 'improving',
      label: 'Improving',
      delta: 4,
    });
    expect(trends.provision).toMatchObject({
      direction: 'steady',
      label: 'Holding steady',
      delta: -1,
    });
    expect(trends.protection.elapsedDays).toBe(10);
  });

  it('does not label a trend without a week-old recorded comparison', () => {
    const trends = buildPillarTrends(scores, [], new Date('2026-08-30T00:00:00.000Z'));

    expect(trends.peace).toMatchObject({
      direction: 'not_enough_history',
      label: 'More recorded history needed',
      delta: null,
    });
  });
});
