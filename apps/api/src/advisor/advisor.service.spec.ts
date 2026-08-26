import { describe, expect, it, vi } from 'vitest';

import { ReadinessService } from '../readiness/readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TimelineService } from '../timeline/timeline.service';
import { AdvisorService } from './advisor.service';

describe('AdvisorService', () => {
  it('builds a deterministic brief from readiness, actions, and recorded events', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [],
        overallAssessment: { score: 62, state: 'partial', coverage: 55 },
        topRisks: [{ summary: 'Liquid reserves need attention.' }],
      }),
    } as unknown as ReadinessService;
    const recommendations = {
      synchronize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        {
          status: 'ACTIVE',
          signalSummary: 'Build a reserve.',
          action: 'Review liquid accounts',
          actionHref: '/accounts',
        },
      ]),
    } as unknown as RecommendationsService;
    const timeline = {
      listUpcoming: vi.fn().mockResolvedValue([
        {
          id: 'income-1',
          kind: 'INCOME',
          date: new Date('2026-08-27T00:00:00.000Z'),
          title: 'Primary employment',
          detail: 'Recorded expected income date',
          href: '/income-sources',
        },
      ]),
    } as unknown as TimelineService;
    const advisor = new AdvisorService(readiness, recommendations, timeline);

    const brief = await advisor.getMorningBrief('user-1');

    expect(brief).toMatchObject({
      greeting: 'Good morning',
      readiness: { score: 62, state: 'partial', coverage: 55 },
      priority: { summary: 'Build a reserve.', href: '/accounts' },
      currentRisk: 'Liquid reserves need attention.',
    });
    expect(brief.upcoming).toHaveLength(1);
    expect(vi.mocked(recommendations.synchronize)).toHaveBeenCalledWith('user-1', []);
    expect(vi.mocked(timeline.listUpcoming)).toHaveBeenCalledWith('user-1', 7);
  });
});
