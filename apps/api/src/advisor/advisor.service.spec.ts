import { describe, expect, it, vi } from 'vitest';

import { ReadinessService } from '../readiness/readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TimelineService } from '../timeline/timeline.service';
import { AdvisorService, crossCapabilityInsightCandidates } from './advisor.service';

describe('AdvisorService', () => {
  it('builds a deterministic brief from readiness, actions, and recorded events', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [],
        overallAssessment: { score: 62, state: 'partial', coverage: 55 },
        topRisks: [{ summary: 'Liquid reserves need attention.' }],
        trendWindows: [
          { days: 7, delta: 4, comparedTo: new Date('2026-08-19T00:00:00.000Z'), elapsedDays: 7 },
          { days: 30, delta: null, comparedTo: null, elapsedDays: null },
        ],
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
        {
          status: 'COMPLETED',
          signalSummary: 'Update policy details.',
          action: 'Review policies',
          completedAt: new Date(),
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
    const advisor = new AdvisorService(readiness, recommendations, timeline, {} as never);

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

  it('reports recorded trend data and recently completed recommendations for periodic briefs', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [
          {
            capabilityId: 'emergency-fund',
            type: 'warning',
            magnitude: -2,
            pillar: 'protection',
            summary: 'Liquid reserves need attention.',
          },
        ],
        overallAssessment: { score: 62, state: 'partial', coverage: 55 },
        topRisks: [{ summary: 'Liquid reserves need attention.' }],
        trendWindows: [
          { days: 7, delta: 4, comparedTo: new Date('2026-08-19T00:00:00.000Z'), elapsedDays: 7 },
          { days: 30, delta: null, comparedTo: null, elapsedDays: null },
        ],
      }),
    } as unknown as ReadinessService;
    const recommendations = {
      synchronize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        {
          status: 'COMPLETED',
          signalSummary: 'Update policy details.',
          action: 'Review policies',
          completedAt: new Date(),
        },
      ]),
    } as unknown as RecommendationsService;
    const timeline = { listUpcoming: vi.fn().mockResolvedValue([]) } as unknown as TimelineService;
    const prisma = {
      readinessSnapshot: { findFirst: vi.fn().mockResolvedValue({ signals: [] }) },
    };
    const advisor = new AdvisorService(readiness, recommendations, timeline, prisma as never);

    await expect(advisor.getWeeklyBrief('user-1')).resolves.toMatchObject({
      periodDays: 7,
      scoreChange: { delta: 4, elapsedDays: 7 },
      actionsCompleted: 1,
      observedRisks: ['Liquid reserves need attention.'],
      newRisks: ['Liquid reserves need attention.'],
    });
    await expect(advisor.getMonthlyBrief('user-1')).resolves.toMatchObject({
      periodDays: 30,
      scoreChange: { delta: null, comparedTo: null },
    });
    expect(vi.mocked(timeline.listUpcoming)).toHaveBeenNthCalledWith(1, 'user-1', 7);
    expect(vi.mocked(timeline.listUpcoming)).toHaveBeenNthCalledWith(2, 'user-1', 30);
    expect(prisma.readinessSnapshot.findFirst).toHaveBeenCalledTimes(1);
  });

  it('refreshes and returns recommendations from their existing priority order', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({ signals: [{ capabilityId: 'insurance' }] }),
    } as unknown as ReadinessService;
    const recordedRecommendations = [{ id: 'rec-1', capabilityId: 'insurance', priorityScore: 260 }];
    const recommendations = {
      synchronize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue(recordedRecommendations),
    } as unknown as RecommendationsService;
    const timeline = {} as TimelineService;
    const advisor = new AdvisorService(readiness, recommendations, timeline, {} as never);

    await expect(advisor.getRecommendations('user-1')).resolves.toEqual(recordedRecommendations);
    expect(vi.mocked(recommendations.synchronize)).toHaveBeenCalledWith('user-1', [
      { capabilityId: 'insurance' },
    ]);
  });

  it('only creates insights when recorded risks span the supported capabilities', () => {
    expect(
      crossCapabilityInsightCandidates([
        { capabilityId: 'emergency-fund', type: 'warning', magnitude: -2, pillar: 'protection', summary: 'Reserve low.' },
        { capabilityId: 'insurance-deductibles', type: 'risk', magnitude: -3, pillar: 'protection', summary: 'Deductible high.' },
      ]),
    ).toMatchObject([
      { sourceCapabilities: ['emergency-fund', 'insurance-deductibles'], actionHref: '/insurance' },
    ]);
    expect(crossCapabilityInsightCandidates([])).toEqual([]);
  });

  it('connects vehicle, home, and continuity risks to their related household context', () => {
    const candidates = crossCapabilityInsightCandidates([
      { capabilityId: 'vehicle-maintenance', type: 'risk', magnitude: -4, pillar: 'preparation', summary: 'Service overdue.' },
      { capabilityId: 'cashflow', type: 'warning', magnitude: -3, pillar: 'provision', summary: 'Cash constrained.' },
      { capabilityId: 'home-assets', type: 'risk', magnitude: -4, pillar: 'preparation', summary: 'HVAC aging.' },
      { capabilityId: 'emergency-fund', type: 'warning', magnitude: -2, pillar: 'protection', summary: 'Reserve low.' },
      { capabilityId: 'estate-documents', type: 'risk', magnitude: -4, pillar: 'protection', summary: 'Will missing.' },
      { capabilityId: 'household-transitions', type: 'warning', magnitude: -2, pillar: 'protection', summary: 'Plan review passed.' },
    ]);

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionHref: '/vehicles', sourceCapabilities: ['vehicle-maintenance', 'cashflow'] }),
      expect.objectContaining({ actionHref: '/home-maintenance', sourceCapabilities: ['home-assets', 'emergency-fund'] }),
      expect.objectContaining({ actionHref: '/household-transitions', sourceCapabilities: ['estate-documents', 'household-transitions'] }),
    ]));
  });
});
