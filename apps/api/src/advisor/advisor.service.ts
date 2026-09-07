import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';

import { Signal } from '@wardkeep/readiness';

import { PrismaService } from '../prisma/prisma.service';
import { ReadinessService } from '../readiness/readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TimelineEvent, TimelineService } from '../timeline/timeline.service';

export interface MorningBrief {
  greeting: string;
  readiness: { score: number | null; state: 'known' | 'partial' | 'not_evaluated'; coverage: number };
  priority: { summary: string; action: string; href: string } | null;
  currentRisk: string | null;
  observations: Array<{
    kind: 'budget_warning' | 'budget_overspent' | 'unusual_charge' | 'spending_shift';
    summary: string;
    action: string;
    href: string;
  }>;
  upcoming: TimelineEvent[];
}

export interface PeriodicBrief {
  periodDays: 7 | 30;
  readiness: MorningBrief['readiness'];
  /** Null means Wardkeep does not yet have an observation old enough to compare. */
  scoreChange: {
    delta: number | null;
    comparedTo: Date | null;
    elapsedDays: number | null;
  };
  actionsCompleted: number;
  completedRecommendations: Array<{ summary: string; action: string; completedAt: Date }>;
  observedRisks: string[];
  /** Risks or warnings whose source signal was absent from the comparison snapshot. */
  newRisks: string[];
  upcoming: TimelineEvent[];
}

type InsightCandidate = {
  fingerprint: string;
  summary: string;
  action: string;
  actionHref: string;
  sourceCapabilities: string[];
};

function hasRisk(signals: readonly Signal[], capabilityId: string) {
  return signals.some(
    (signal) =>
      signal.capabilityId === capabilityId && (signal.type === 'risk' || signal.type === 'warning'),
  );
}

export function crossCapabilityInsightCandidates(signals: readonly Signal[]): InsightCandidate[] {
  const candidates: Omit<InsightCandidate, 'fingerprint'>[] = [];
  if (hasRisk(signals, 'emergency-fund') && hasRisk(signals, 'insurance-deductibles')) {
    candidates.push({
      summary:
        'Liquid reserves are below recorded insurance deductibles. Review the reserve before increasing deductibles or relying on that cash for another plan.',
      action: 'Review reserves and deductibles',
      actionHref: '/insurance',
      sourceCapabilities: ['emergency-fund', 'insurance-deductibles'],
    });
  }
  if (
    hasRisk(signals, 'planned-expenses') &&
    (hasRisk(signals, 'cashflow') || hasRisk(signals, 'recurring'))
  ) {
    candidates.push({
      summary:
        'A recorded planned expense is not fully set aside while near-term cash flow is constrained. Review both dates before committing discretionary cash.',
      action: 'Review planned expense funding',
      actionHref: '/planned-expenses',
      sourceCapabilities: [
        'planned-expenses',
        hasRisk(signals, 'cashflow') ? 'cashflow' : 'recurring',
      ],
    });
  }
  if (
    (hasRisk(signals, 'vehicle-maintenance') || hasRisk(signals, 'vehicle-lease')) &&
    (hasRisk(signals, 'cashflow') || hasRisk(signals, 'planned-expenses'))
  ) {
    const vehicleSource = hasRisk(signals, 'vehicle-maintenance')
      ? 'vehicle-maintenance'
      : 'vehicle-lease';
    candidates.push({
      summary:
        'A vehicle-related deadline is approaching while recorded cash flow or planned-expense funding is constrained. Review the timing and set aside only an amount your household has recorded as available.',
      action: 'Review vehicle timing and cash flow',
      actionHref: '/vehicles',
      sourceCapabilities: [
        vehicleSource,
        hasRisk(signals, 'cashflow') ? 'cashflow' : 'planned-expenses',
      ],
    });
  }
  if (hasRisk(signals, 'home-assets') && hasRisk(signals, 'emergency-fund')) {
    candidates.push({
      summary:
        'A recorded home asset is near its expected lifespan while liquid reserves are limited. Review the replacement estimate and decide whether a separate savings target is appropriate for your household.',
      action: 'Review home replacement planning',
      actionHref: '/home-maintenance',
      sourceCapabilities: ['home-assets', 'emergency-fund'],
    });
  }
  if (hasRisk(signals, 'estate-documents') && hasRisk(signals, 'household-transitions')) {
    candidates.push({
      summary:
        'Estate-document records and a household continuity plan both need attention. Review the recorded dates and locations together; Wardkeep does not assess legal adequacy or replace professional advice.',
      action: 'Review continuity records',
      actionHref: '/household-transitions',
      sourceCapabilities: ['estate-documents', 'household-transitions'],
    });
  }
  return candidates.map((candidate) => ({
    ...candidate,
    fingerprint: createHash('sha256')
      .update(candidate.sourceCapabilities.slice().sort().join('|'))
      .digest('hex'),
  }));
}

@Injectable()
export class AdvisorService {
  constructor(
    private readonly readiness: ReadinessService,
    private readonly recommendations: RecommendationsService,
    private readonly timeline: TimelineService,
    private readonly prisma: PrismaService,
  ) {}

  /** Builds a deterministic morning brief from recorded readiness and timeline data. */
  async getMorningBrief(userId: string, now = new Date()): Promise<MorningBrief> {
    const readiness = await this.readiness.getReadiness(userId);
    await this.recommendations.synchronize(userId, readiness.signals);
    const [recommendations, upcoming, budgetObservations, unusualChargeObservations, spendingShiftObservations] = await Promise.all([
      this.recommendations.list(userId),
      this.timeline.listUpcoming(userId, 7),
      this.getBudgetObservations(userId, now),
      this.getUnusualChargeObservations(userId, now),
      this.getSpendingShiftObservations(userId, now),
    ]);
    const recommendation = recommendations.find((candidate) => candidate.status === 'ACTIVE') ?? null;
    const currentRisk = readiness.topRisks[0]?.summary ?? null;

    return {
      greeting: 'Good morning',
      readiness: {
        score: readiness.overallAssessment.score,
        state: readiness.overallAssessment.state,
        coverage: readiness.overallAssessment.coverage,
      },
      priority: recommendation
        ? {
            summary: recommendation.signalSummary,
            action: recommendation.action,
            href: recommendation.actionHref,
          }
        : null,
      currentRisk,
      observations: [...budgetObservations, ...unusualChargeObservations, ...spendingShiftObservations],
      upcoming,
    };
  }

  /** Returns today's scheduled local briefing when available, otherwise computes the same deterministic view. */
  async getDailyMorningBrief(userId: string, now = new Date()): Promise<MorningBrief> {
    const briefingDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const stored = await this.prisma.dailyBrief.findUnique({
      where: { userId_briefingDate: { userId, briefingDate } },
      select: { content: true },
    });
    return stored ? (stored.content as unknown as MorningBrief) : this.getMorningBrief(userId, now);
  }

  /** Generates one local, deterministic briefing snapshot per household for the UTC day. */
  async generateDailyBriefs(now = new Date()) {
    const briefingDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let generated = 0;
    let failed = 0;
    for (const user of users) {
      try {
        const content = await this.getMorningBrief(user.id, now);
        await this.prisma.dailyBrief.upsert({
          where: { userId_briefingDate: { userId: user.id, briefingDate } },
          update: { content: content as unknown as Prisma.InputJsonValue },
          create: { userId: user.id, briefingDate, content: content as unknown as Prisma.InputJsonValue },
        });
        generated++;
      } catch {
        failed++;
      }
    }
    return { generated, failed };
  }

  /** Reports recorded month-to-date budget usage; it does not forecast spending. */
  private async getBudgetObservations(userId: string, now: Date): Promise<MorningBrief['observations']> {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const allocations = await this.prisma.budgetAllocation.findMany({
      where: { budget: { userId, month: monthStart } },
      include: { category: { select: { name: true } } },
    });
    if (allocations.length === 0) return [];

    const spending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'DEBIT',
        categoryId: { in: allocations.map((allocation) => allocation.categoryId) },
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    });
    const spentByCategory = new Map(
      spending.map((row) => [row.categoryId, new Prisma.Decimal(row._sum.amount ?? 0)]),
    );

    return allocations
      .map((allocation) => {
        const allocated = new Prisma.Decimal(allocation.amount);
        if (allocated.lte(0)) return null;
        const spent = spentByCategory.get(allocation.categoryId) ?? new Prisma.Decimal(0);
        const percentUsed = spent.dividedBy(allocated).times(100).toDecimalPlaces(0).toNumber();
        if (percentUsed < 90) return null;
        const overspent = percentUsed >= 100;
        const kind: 'budget_warning' | 'budget_overspent' = overspent
          ? 'budget_overspent'
          : 'budget_warning';
        return {
          kind,
          summary: `${allocation.category.name} has used ${percentUsed}% of its recorded monthly allocation (${spent.toFixed(2)} of ${allocated.toFixed(2)}).`,
          action: 'Review budget',
          href: '/budgets',
        };
      })
      .filter(
        (observation): observation is { kind: 'budget_warning' | 'budget_overspent'; summary: string; action: string; href: string } =>
          observation !== null,
      )
      .sort((a, b) => (a.kind === b.kind ? a.summary.localeCompare(b.summary) : a.kind === 'budget_overspent' ? -1 : 1));
  }

  /**
   * Identifies only recent, merchant-matched debits that exceed the recorded
   * median materially. It does not infer fraud, recurrence, or intent.
   */
  private async getUnusualChargeObservations(userId: string, now: Date): Promise<MorningBrief['observations']> {
    const recentStart = new Date(now);
    recentStart.setUTCDate(recentStart.getUTCDate() - 7);
    const historyStart = new Date(recentStart);
    historyStart.setUTCDate(historyStart.getUTCDate() - 90);
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: 'DEBIT', date: { gte: historyStart, lte: now }, merchant: { not: null } },
      select: { id: true, date: true, amount: true, merchant: true },
      orderBy: { date: 'desc' },
    });
    const historyByMerchant = new Map<string, Prisma.Decimal[]>();
    for (const transaction of transactions) {
      if (!transaction.merchant || transaction.date >= recentStart) continue;
      const merchant = transaction.merchant.trim();
      if (!merchant) continue;
      const values = historyByMerchant.get(merchant.toLocaleLowerCase()) ?? [];
      values.push(new Prisma.Decimal(transaction.amount));
      historyByMerchant.set(merchant.toLocaleLowerCase(), values);
    }

    return transactions
      .filter((transaction) => transaction.merchant && transaction.date >= recentStart)
      .map((transaction) => {
        const merchant = transaction.merchant!.trim();
        const earlierCharges = historyByMerchant.get(merchant.toLocaleLowerCase()) ?? [];
        if (earlierCharges.length < 3) return null;
        const ordered = earlierCharges.slice().sort((a, b) => a.comparedTo(b));
        const midpoint = Math.floor(ordered.length / 2);
        const median = ordered.length % 2 === 0
          ? ordered[midpoint - 1].plus(ordered[midpoint]).dividedBy(2)
          : ordered[midpoint];
        const amount = new Prisma.Decimal(transaction.amount);
        const difference = amount.minus(median);
        if (median.lte(0) || difference.lt(20) || amount.lt(median.times(1.5))) return null;
        const percentAbove = difference.dividedBy(median).times(100).toDecimalPlaces(0).toNumber();
        return {
          kind: 'unusual_charge' as const,
          summary: `A recorded debit at ${merchant} (${amount.toFixed(2)}) is ${percentAbove}% above the median of ${earlierCharges.length} earlier recorded charges (${median.toFixed(2)}).`,
          action: 'Review transaction',
          href: '/transactions',
        };
      })
      .filter(
        (observation): observation is { kind: 'unusual_charge'; summary: string; action: string; href: string } =>
          observation !== null,
      )
      .slice(0, 3);
  }

  /** Compares only equivalent recorded calendar-to-date category spending. */
  private async getSpendingShiftObservations(userId: string, now: Date): Promise<MorningBrief['observations']> {
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate() + 1));
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'DEBIT',
        categoryId: { not: null },
        OR: [
          { date: { gte: currentStart, lt: currentEnd } },
          { date: { gte: previousStart, lt: previousEnd } },
        ],
      },
      select: { amount: true, categoryId: true, date: true, category: { select: { name: true } } },
    });
    const currentByCategory = new Map<string, { name: string; amount: Prisma.Decimal }>();
    const previousByCategory = new Map<string, Prisma.Decimal>();
    for (const transaction of transactions) {
      if (!transaction.categoryId || !transaction.category) continue;
      const amount = new Prisma.Decimal(transaction.amount);
      if (transaction.date >= currentStart) {
        const existing = currentByCategory.get(transaction.categoryId);
        currentByCategory.set(transaction.categoryId, {
          name: transaction.category.name,
          amount: (existing?.amount ?? new Prisma.Decimal(0)).plus(amount),
        });
      } else {
        previousByCategory.set(
          transaction.categoryId,
          (previousByCategory.get(transaction.categoryId) ?? new Prisma.Decimal(0)).plus(amount),
        );
      }
    }

    return [...currentByCategory.entries()]
      .map(([categoryId, current]) => {
        const previous = previousByCategory.get(categoryId);
        if (!previous || previous.lte(0)) return null;
        const difference = current.amount.minus(previous);
        if (difference.lt(20) || current.amount.lt(previous.times(1.5))) return null;
        const percentAbove = difference.dividedBy(previous).times(100).toDecimalPlaces(0).toNumber();
        return {
          kind: 'spending_shift' as const,
          summary: `${current.name} spending is ${percentAbove}% higher so far this month (${current.amount.toFixed(2)} versus ${previous.toFixed(2)} at the same point last month).`,
          action: 'Review transactions',
          href: '/transactions',
        };
      })
      .filter(
        (observation): observation is { kind: 'spending_shift'; summary: string; action: string; href: string } =>
          observation !== null,
      )
      .sort((a, b) => b.summary.localeCompare(a.summary))
      .slice(0, 3);
  }

  /**
   * Creates a recorded-data-only weekly or monthly review. A missing score
   * comparison remains explicitly unknown instead of being estimated.
   */
  async getPeriodicBrief(userId: string, periodDays: 7 | 30): Promise<PeriodicBrief> {
    const readiness = await this.readiness.getReadiness(userId);
    await this.recommendations.synchronize(userId, readiness.signals);
    const [recommendations, upcoming] = await Promise.all([
      this.recommendations.list(userId),
      this.timeline.listUpcoming(userId, periodDays),
    ]);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const completedRecommendations = recommendations
      .filter(
        (recommendation) =>
          recommendation.status === 'COMPLETED' &&
          recommendation.completedAt !== null &&
          recommendation.completedAt >= cutoff,
      )
      .map((recommendation) => ({
        summary: recommendation.signalSummary,
        action: recommendation.action,
        completedAt: recommendation.completedAt!,
      }));
    const trend = readiness.trendWindows.find((window) => window.days === periodDays);
    const comparisonSnapshot = trend?.comparedTo
      ? await this.prisma.readinessSnapshot.findFirst({
          where: { userId, recordedAt: { lte: trend.comparedTo } },
          orderBy: { recordedAt: 'desc' },
          include: { signals: true },
        })
      : null;
    const priorRiskKeys = new Set(
      (comparisonSnapshot?.signals ?? [])
        .filter((signal) => signal.type === 'RISK' || signal.type === 'WARNING')
        .map((signal) => `${signal.capabilityId}|${signal.type}`),
    );
    const newRisks = comparisonSnapshot
      ? readiness.signals
          .filter((signal) => signal.type === 'risk' || signal.type === 'warning')
          .filter(
            (signal) => !priorRiskKeys.has(`${signal.capabilityId}|${signal.type.toUpperCase()}`),
          )
          .map((signal) => signal.summary)
      : [];

    return {
      periodDays,
      readiness: {
        score: readiness.overallAssessment.score,
        state: readiness.overallAssessment.state,
        coverage: readiness.overallAssessment.coverage,
      },
      scoreChange: {
        delta: trend?.delta ?? null,
        comparedTo: trend?.comparedTo ?? null,
        elapsedDays: trend?.elapsedDays ?? null,
      },
      actionsCompleted: completedRecommendations.length,
      completedRecommendations,
      observedRisks: readiness.topRisks.map((risk) => risk.summary),
      newRisks,
      upcoming,
    };
  }

  getWeeklyBrief(userId: string): Promise<PeriodicBrief> {
    return this.getPeriodicBrief(userId, 7);
  }

  getMonthlyBrief(userId: string): Promise<PeriodicBrief> {
    return this.getPeriodicBrief(userId, 30);
  }

  /** Returns the current, source-linked recommendations in their recorded priority order. */
  async getRecommendations(userId: string) {
    const readiness = await this.readiness.getReadiness(userId);
    await this.recommendations.synchronize(userId, readiness.signals);
    return this.recommendations.list(userId);
  }

  /** Stores cross-capability observations, but does not repeat one within seven days. */
  async getCrossCapabilityInsights(userId: string) {
    const readiness = await this.readiness.getReadiness(userId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const candidates = crossCapabilityInsightCandidates(readiness.signals);
    const insights = await Promise.all(
      candidates.map(async (candidate) => {
        const existing = await this.prisma.advisorInsight.findFirst({
          where: { userId, fingerprint: candidate.fingerprint, createdAt: { gte: cutoff } },
          orderBy: { createdAt: 'desc' },
        });
        return existing ?? this.prisma.advisorInsight.create({ data: { userId, ...candidate } });
      }),
    );
    return insights.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}
