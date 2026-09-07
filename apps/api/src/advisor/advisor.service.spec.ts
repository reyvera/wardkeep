import { describe, expect, it, vi } from 'vitest';

import { ReadinessService } from '../readiness/readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TimelineService } from '../timeline/timeline.service';
import { AdvisorService, crossCapabilityInsightCandidates } from './advisor.service';

describe('AdvisorService', () => {
  it('returns today’s stored deterministic brief without recalculating it', async () => {
    const stored = {
      greeting: 'Good morning',
      readiness: { score: 70, state: 'known', coverage: 80 },
      priority: null,
      currentRisk: null,
      observations: [],
      upcoming: [],
    };
    const advisor = new AdvisorService(
      { getReadiness: vi.fn() } as never,
      {} as never,
      {} as never,
      { dailyBrief: { findUnique: vi.fn().mockResolvedValue({ content: stored }) } } as never,
    );

    await expect(advisor.getDailyMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toEqual(stored);
  });

  it('keeps the first generated daily brief when the worker retries that date', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'brief-1' });
    const advisor = new AdvisorService(
      {} as never,
      {} as never,
      {} as never,
      {
        user: { findMany: vi.fn().mockResolvedValue([{ id: 'user-1' }]) },
        dailyBrief: { upsert },
      } as never,
    );
    vi.spyOn(advisor, 'getMorningBrief').mockResolvedValue({
      greeting: 'Good morning',
      readiness: { score: 65, state: 'known', coverage: 80 },
      priority: null,
      currentRisk: null,
      observations: [],
      annualContext: [],
      seasonalContext: [],
      upcoming: [],
    });

    await expect(advisor.generateDailyBriefs(new Date('2026-09-07T12:00:00Z'))).resolves.toEqual({ generated: 1, failed: 0 });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {},
      create: expect.objectContaining({ userId: 'user-1' }),
    }));
  });

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
          id: 'recommendation-1',
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
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(readiness, recommendations, timeline, prisma as never);

    const brief = await advisor.getMorningBrief('user-1');

    expect(brief).toMatchObject({
      greeting: 'Good morning',
      readiness: { score: 62, state: 'partial', coverage: 55 },
      priority: { id: 'recommendation-1', summary: 'Build a reserve.', href: '/accounts' },
      currentRisk: 'Liquid reserves need attention.',
    });
    expect(brief.upcoming).toHaveLength(1);
    expect(brief.observations).toEqual([]);
    expect(vi.mocked(recommendations.synchronize)).toHaveBeenCalledWith('user-1', []);
    expect(vi.mocked(timeline.listUpcoming)).toHaveBeenCalledWith('user-1', 7);
  });

  it('includes recorded budget warnings without predicting future spending', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [],
        overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 },
        topRisks: [],
      }),
    } as never;
    const recommendations = { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never;
    const timeline = { listUpcoming: vi.fn().mockResolvedValue([]) } as never;
    const prisma = {
      budgetAllocation: {
        findMany: vi.fn().mockResolvedValue([
          { categoryId: 'groceries', amount: '400', category: { name: 'Groceries' } },
          { categoryId: 'fuel', amount: '100', category: { name: 'Fuel' } },
        ]),
      },
      transaction: {
        groupBy: vi.fn().mockResolvedValue([
          { categoryId: 'groceries', _sum: { amount: '440' } },
          { categoryId: 'fuel', _sum: { amount: '95' } },
        ]),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(readiness, recommendations, timeline, prisma as never);

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      observations: [
        { kind: 'budget_overspent', summary: 'Groceries has used 110% of its recorded monthly allocation (440.00 of 400.00).' },
        { kind: 'budget_warning', summary: 'Fuel has used 95% of its recorded monthly allocation (95.00 of 100.00).' },
      ],
    });
  });

  it('flags only materially higher recent charges with enough recorded merchant history', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [],
        overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 },
        topRisks: [],
      }),
    } as never;
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'recent', date: new Date('2026-09-06T00:00:00Z'), amount: '120', merchant: 'Example Store' },
          { id: 'old-1', date: new Date('2026-08-20T00:00:00Z'), amount: '60', merchant: 'Example Store' },
          { id: 'old-2', date: new Date('2026-08-01T00:00:00Z'), amount: '70', merchant: 'example store' },
          { id: 'old-3', date: new Date('2026-07-10T00:00:00Z'), amount: '80', merchant: 'Example Store' },
          { id: 'small', date: new Date('2026-09-05T00:00:00Z'), amount: '25', merchant: 'Small purchase' },
        ]),
        count: vi.fn().mockResolvedValue(0),
      },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(
      readiness,
      { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never,
      { listUpcoming: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
    );

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      observations: [
        {
          kind: 'unusual_charge',
          summary: 'A recorded debit at Example Store (120.00) is 71% above the median of 3 earlier recorded charges (70.00).',
        },
      ],
    });
  });

  it('compares category spending only to the same recorded point last month', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [],
        overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 },
        topRisks: [],
      }),
    } as never;
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { categoryId: 'dining', date: new Date('2026-09-06T00:00:00Z'), amount: '180', category: { name: 'Dining' } },
            { categoryId: 'dining', date: new Date('2026-08-05T00:00:00Z'), amount: '90', category: { name: 'Dining' } },
            { categoryId: 'fuel', date: new Date('2026-09-05T00:00:00Z'), amount: '30', category: { name: 'Fuel' } },
            { categoryId: 'fuel', date: new Date('2026-08-05T00:00:00Z'), amount: '25', category: { name: 'Fuel' } },
          ])
          .mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(
      readiness,
      { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never,
      { listUpcoming: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
    );

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      observations: [
        {
          kind: 'spending_shift',
          summary: 'Dining spending is 100% higher so far this month (180.00 versus 90.00 at the same point last month).',
        },
      ],
    });
  });

  it('links recent uncategorized debits for review without assigning a category', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [], overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 }, topRisks: [],
      }),
    } as never;
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(2) },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(
      readiness,
      { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never,
      { listUpcoming: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
    );

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      observations: [{
        kind: 'categorization_review',
        summary: '2 recent debits are uncategorized and ready for your review.',
        href: '/transactions?categoryId=NONE&isReviewed=false',
      }],
    });
  });

  it('surfaces an upcoming manually recorded annual event without duplicating a recurring bill', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [], overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 }, topRisks: [],
      }),
    } as never;
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      advisorMemory: {
        findMany: vi.fn().mockResolvedValue([
          { summary: 'Start planning the family holiday gathering.', observedAt: new Date('2025-09-20T00:00:00Z'), sourceRefs: [] },
          { summary: 'Annual insurance bill.', observedAt: new Date('2025-09-15T00:00:00Z'), sourceRefs: ['recurring:bill-1'] },
        ]),
      },
    };
    const advisor = new AdvisorService(
      readiness,
      { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never,
      { listUpcoming: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
    );

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      annualContext: [{ summary: 'Start planning the family holiday gathering.', date: new Date('2026-09-20T00:00:00Z') }],
    });
  });

  it('shows seasonal context only when the same category has records in both prior years', async () => {
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({
        signals: [], overallAssessment: { score: null, state: 'not_evaluated', coverage: 0 }, topRisks: [],
      }),
    } as never;
    const prisma = {
      budgetAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      transaction: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { categoryId: 'travel', amount: '800', date: new Date('2025-09-12T00:00:00Z'), category: { name: 'Travel' } },
            { categoryId: 'travel', amount: '650', date: new Date('2024-09-17T00:00:00Z'), category: { name: 'Travel' } },
            { categoryId: 'dining', amount: '100', date: new Date('2025-09-10T00:00:00Z'), category: { name: 'Dining' } },
          ]),
        count: vi.fn().mockResolvedValue(0),
      },
      advisorMemory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const advisor = new AdvisorService(
      readiness,
      { synchronize: vi.fn(), list: vi.fn().mockResolvedValue([]) } as never,
      { listUpcoming: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
    );

    await expect(advisor.getMorningBrief('user-1', new Date('2026-09-07T12:00:00Z'))).resolves.toMatchObject({
      seasonalContext: ['Recorded September Travel spending was 800.00 in 2025 and 650.00 in 2024.'],
    });
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
