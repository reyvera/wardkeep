import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

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
  async getMorningBrief(userId: string): Promise<MorningBrief> {
    const readiness = await this.readiness.getReadiness(userId);
    await this.recommendations.synchronize(userId, readiness.signals);
    const [recommendations, upcoming] = await Promise.all([
      this.recommendations.list(userId),
      this.timeline.listUpcoming(userId, 7),
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
      upcoming,
    };
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
