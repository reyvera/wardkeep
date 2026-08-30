import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Decimal } from 'decimal.js';

import { computePillarScore, Signal } from '@wardkeep/readiness';

import { PrismaService } from '../prisma/prisma.service';

type EvidenceState = 'synchronized' | 'manual' | 'mixed' | 'stale' | 'calculated' | 'unknown';
type SignalWithProvenance = Signal & {
  provenance: { limitation: string; evidenceState: EvidenceState };
};
type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

const ACTIONS: Record<string, { action: string; href: string }> = {
  'emergency-fund': { action: 'Review liquid accounts', href: '/accounts' },
  insurance: { action: 'Review policies', href: '/insurance' },
  'insurance-deductibles': { action: 'Review deductibles', href: '/insurance' },
  'insurance-coverage-target': { action: 'Review coverage target', href: '/insurance' },
  budgets: { action: 'Review budget', href: '/budget' },
  cashflow: { action: 'Review cash flow', href: '/dashboard/details' },
  recurring: { action: 'Review recurring bills', href: '/recurring' },
  accounts: { action: 'Review accounts', href: '/accounts' },
  debt: { action: 'Review debt', href: '/debt' },
};

export function recommendationCandidate(
  signal: SignalWithProvenance,
  pillarSignals: readonly Signal[] = [signal],
) {
  const route = ACTIONS[signal.capabilityId] ?? {
    action: 'View readiness factor',
    href: `/dashboard/readiness/${signal.pillar}`,
  };
  const severity = Math.min(10, Math.abs(signal.magnitude));
  const urgency = signal.type === 'risk' ? 3 : 2;
  const confidenceByEvidenceState: Record<EvidenceState, number> = {
    synchronized: 1,
    manual: 0.85,
    mixed: 0.8,
    stale: 0.5,
    calculated: 0.9,
    unknown: 0.65,
  };
  const confidence = confidenceByEvidenceState[signal.provenance.evidenceState];
  const supportingSources = Array.isArray(signal.provenance.sources)
    ? signal.provenance.sources
    : ['Current Wardkeep records'];
  const supportingMethod = signal.provenance.method ?? 'Derives an explainable signal from available records.';
  const financialImpactWeight =
    signal.financialImpact?.amount || signal.financialImpact?.monthlyAmount ? 10 : 0;
  const priorityScore = Math.round(
    (severity * 30 + urgency * 20 + 20 + financialImpactWeight) * confidence,
  );
  const priority: RecommendationPriority =
    priorityScore >= 280
      ? 'critical'
      : priorityScore >= 200
        ? 'high'
        : priorityScore >= 120
          ? 'medium'
          : 'low';
  const fingerprint = createHash('sha256')
    .update(`${signal.capabilityId}|${signal.type}|${signal.summary}`)
    .digest('hex');
  const currentPillarScore = computePillarScore(signal.pillar, pillarSignals);
  const remainingSignals = pillarSignals.filter((candidate) => candidate !== signal);
  const projectedPillarScore = remainingSignals.length
    ? computePillarScore(signal.pillar, remainingSignals)
    : null;
  const projectedPillarDelta =
    projectedPillarScore === null ? null : Math.max(0, projectedPillarScore - currentPillarScore);
  const impactPreview =
    projectedPillarDelta && projectedPillarDelta > 0
      ? `If this source risk is resolved and the other observed ${signal.pillar} factors stay the same, ${signal.pillar} could increase by about ${projectedPillarDelta} points.`
      : 'Wardkeep will measure any score change after this action is reflected in your records; it cannot reliably project a numeric change from this factor alone.';

  return {
    fingerprint,
    capabilityId: signal.capabilityId,
    pillar: signal.pillar,
    signalSummary: signal.summary,
    action: route.action,
    actionHref: route.href,
    reasoning: signal.summary,
    priority,
    priorityScore,
    confidence: new Decimal(confidence),
    supportingData: [
      ...supportingSources,
      `Method: ${supportingMethod}`,
    ],
    relevanceDate: signal.relevanceDate ?? null,
    assumptions: signal.provenance.limitation,
    impactPreview,
    projectedPillarDelta,
    estimatedAmount: signal.financialImpact?.amount
      ? new Decimal(signal.financialImpact.amount)
      : null,
    estimatedMonthlyAmount: signal.financialImpact?.monthlyAmount
      ? new Decimal(signal.financialImpact.monthlyAmount)
      : null,
    estimatedAmountLabel: signal.financialImpact?.label ?? null,
    estimatedCompletionDays: signal.financialImpact?.timeToCompletionDays ?? null,
  };
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async synchronize(userId: string, signals: SignalWithProvenance[]) {
    const candidates = signals
      .filter((signal) => signal.type === 'risk' || signal.type === 'warning')
      .map((signal) =>
        recommendationCandidate(
          signal,
          signals.filter((candidate) => candidate.pillar === signal.pillar),
        ),
      );
    const fingerprints = candidates.map((candidate) => candidate.fingerprint);
    const existing =
      fingerprints.length === 0
        ? []
        : await this.prisma.recommendation.findMany({
            where: { userId, fingerprint: { in: fingerprints } },
            select: { id: true, fingerprint: true, status: true },
          });
    const existingByFingerprint = new Map(
      existing.map((recommendation) => [recommendation.fingerprint, recommendation]),
    );

    await Promise.all(
      candidates.map((candidate) => {
        const prior = existingByFingerprint.get(candidate.fingerprint);
        if (!prior) return this.prisma.recommendation.create({ data: { userId, ...candidate } });
        return this.prisma.recommendation.update({
          where: { id: prior.id },
          data: {
            ...candidate,
            ...(prior.status === 'RESOLVED' ? { status: 'ACTIVE', resolvedAt: null } : {}),
          },
        });
      }),
    );
    await this.prisma.recommendation.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(fingerprints.length > 0 ? { fingerprint: { notIn: fingerprints } } : {}),
      },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  async list(userId: string) {
    const [recommendations, latestSnapshot] = await Promise.all([
      this.prisma.recommendation.findMany({
        where: { userId },
        orderBy: [{ status: 'asc' }, { priorityScore: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.readinessSnapshot.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
        select: { overall: true, recordedAt: true },
      }),
    ]);
    return recommendations.map((recommendation) => ({
      ...recommendation,
      scoreChangeSinceCompletion:
        recommendation.status === 'COMPLETED' &&
        recommendation.scoreAtCompletion !== null &&
        latestSnapshot
          ? latestSnapshot.overall - recommendation.scoreAtCompletion
          : null,
      scoreComparedAt: latestSnapshot?.recordedAt ?? null,
    }));
  }

  async updateStatus(userId: string, id: string, status: 'ACTIVE' | 'DISMISSED' | 'COMPLETED') {
    const recommendation = await this.prisma.recommendation.findFirst({ where: { id, userId } });
    if (!recommendation) throw new NotFoundException('Recommendation not found');
    const now = new Date();
    const completionSnapshot =
      status === 'COMPLETED'
        ? await this.prisma.readinessSnapshot.findFirst({
            where: { userId },
            orderBy: { recordedAt: 'desc' },
            select: { overall: true, recordedAt: true },
          })
        : null;
    return this.prisma.recommendation.update({
      where: { id },
      data: {
        status,
        dismissedAt: status === 'DISMISSED' ? now : null,
        completedAt: status === 'COMPLETED' ? now : null,
        scoreAtCompletion: completionSnapshot?.overall ?? null,
        scoreRecordedAtCompletion: completionSnapshot?.recordedAt ?? null,
        resolvedAt: null,
      },
    });
  }
}
