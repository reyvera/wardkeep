import { Injectable } from '@nestjs/common';

import {
  computePillarScore,
  computeOverallReadiness,
  computePeace,
  Signal,
  PillarScores,
  PillarAssessment,
  ReadinessSnapshot,
} from '@wardkeep/readiness';

import { PrismaService } from '../prisma/prisma.service';
import {
  generateProvisionSignals,
  generateProsperitySignals,
  generateProtectionSignals,
} from './generators';

/** Response shape for the readiness endpoint. */
export interface ReadinessResponse {
  /** The moment Wardkeep derived this readiness response from the available records. */
  evaluatedAt: Date;
  overall: number;
  pillars: PillarScores;
  signals: Signal[];
  topRisks: Signal[];
  topOpportunities: Signal[];
  history: ReadinessSnapshot[];
  overallAssessment: PillarAssessment;
  coverage: number;
  pillarCoverage: Record<Exclude<keyof PillarScores, 'peace'>, number>;
  pillarAssessments: Record<keyof PillarScores, PillarAssessment>;
  dataFreshness: {
    synchronizedAccounts: number;
    manualAccounts: number;
    staleAccounts: number;
    lastSynchronizedAt: Date | null;
  };
  recentChanges: Array<{
    pillar: keyof PillarScores;
    previous: number;
    current: number;
    delta: number;
    comparedTo: Date;
    reason: string | null;
  }>;
  changeWindow: 'since_last_visit' | 'since_last_snapshot' | 'none';
}

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getLastDashboardView(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { lastDashboardViewedAt: true } });
  }

  async recordDashboardView(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastDashboardViewedAt: new Date() } });
  }

  /**
   * Computes the full readiness state for a user.
   * Collects signals from all generators, scores each pillar,
   * computes overall readiness and Peace, and returns the full picture.
   * @param userId - The authenticated user's ID
   * @returns Complete readiness response with scores, signals, and history
   */
  async getReadiness(userId: string, lastViewedAt: Date | null = null): Promise<ReadinessResponse> {
    // Collect signals from all pillar generators in parallel
    const [provisionSignals, prosperitySignals, protectionSignals] = await Promise.all([
      generateProvisionSignals(this.prisma, userId),
      generateProsperitySignals(this.prisma, userId),
      generateProtectionSignals(this.prisma, userId),
    ]);

    const allSignals: Signal[] = [
      ...provisionSignals,
      ...prosperitySignals,
      ...protectionSignals,
    ];

    // Compute pillar scores using the readiness package
    const provision = computePillarScore('provision', allSignals);
    const prosperity = computePillarScore('prosperity', allSignals);
    const protection = computePillarScore('protection', allSignals);
    const preparation = 0; // No generator means unknown, never "perfect"

    const pillarScoresWithoutPeace = { protection, provision, preparation, prosperity };

    // Fetch recent snapshots for Peace calculation
    const recentSnapshots = await this.prisma.readinessSnapshot.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    const history: ReadinessSnapshot[] = recentSnapshots.map((s) => ({
      overall: s.overall,
      pillars: {
        protection: s.protection,
        provision: s.provision,
        preparation: s.preparation,
        prosperity: s.prosperity,
        peace: s.peace,
      },
      recordedAt: s.recordedAt,
    }));

    const peace = computePeace(pillarScoresWithoutPeace, history);
    const overall = computeOverallReadiness(pillarScoresWithoutPeace);

    const pillars: PillarScores = {
      ...pillarScoresWithoutPeace,
      peace,
    };
    const comparisonSnapshot = lastViewedAt
      ? await this.prisma.readinessSnapshot.findFirst({ where: { userId, recordedAt: { lte: lastViewedAt } }, orderBy: { recordedAt: 'desc' } })
      : recentSnapshots[0];
    const changeWindow = comparisonSnapshot ? (lastViewedAt ? 'since_last_visit' : 'since_last_snapshot') : 'none';
    const previousSignals = comparisonSnapshot
      ? await this.prisma.readinessSignal.findMany({ where: { snapshotId: comparisonSnapshot.id } })
      : [];
    const recentChanges = comparisonSnapshot
      ? (Object.keys(pillars) as Array<keyof PillarScores>)
        .map((pillar) => {
          const changedSignal = previousSignals.length === 0 ? undefined : allSignals.find((signal) => signal.pillar === pillar && !previousSignals.some((previous) =>
            previous.capabilityId === signal.capabilityId
            && previous.type.toLowerCase() === signal.type
            && previous.magnitude === Math.round(signal.magnitude),
          ));
          return {
          pillar,
          previous: comparisonSnapshot[pillar],
          current: pillars[pillar],
          delta: pillars[pillar] - comparisonSnapshot[pillar],
          comparedTo: comparisonSnapshot.recordedAt,
          reason: changedSignal?.summary ?? null,
        }})
        .filter((change) => change.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 5)
      : [];

    const directPillars = ['protection', 'provision', 'preparation', 'prosperity'] as const;
    const capabilityTargets: Record<(typeof directPillars)[number], number> = {
      protection: 5, provision: 3, preparation: 4, prosperity: 3,
    };
    const pillarCoverage = Object.fromEntries(directPillars.map((pillar) => {
      const evaluated = new Set(allSignals.filter((signal) => signal.pillar === pillar).map((signal) => signal.capabilityId)).size;
      return [pillar, Math.round(Math.min(1, evaluated / capabilityTargets[pillar]) * 100)];
    })) as ReadinessResponse['pillarCoverage'];
    const coverage = Math.round(directPillars.reduce((sum, pillar) => sum + pillarCoverage[pillar], 0) / directPillars.length);
    const directPillarAssessments = Object.fromEntries(directPillars.map((pillar) => {
      const evaluatedCapabilities = [...new Set(allSignals
        .filter((signal) => signal.pillar === pillar)
        .map((signal) => signal.capabilityId))];
      const pillarCoverageValue = pillarCoverage[pillar];
      return [pillar, {
        state: evaluatedCapabilities.length === 0
          ? 'not_evaluated'
          : pillarCoverageValue >= 75 ? 'known' : 'partial',
        score: evaluatedCapabilities.length === 0 ? null : pillars[pillar],
        coverage: pillarCoverageValue,
        evaluatedCapabilities,
      } satisfies PillarAssessment];
    })) as Record<(typeof directPillars)[number], PillarAssessment>;
    const pillarAssessments: ReadinessResponse['pillarAssessments'] = {
      ...directPillarAssessments,
      peace: {
        state: coverage === 0 ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
        score: coverage === 0 ? null : peace,
        coverage,
        evaluatedCapabilities: directPillars.filter((pillar) => directPillarAssessments[pillar].state !== 'not_evaluated'),
      },
    };
    const overallWeights = { protection: 0.25, provision: 0.30, preparation: 0.20, prosperity: 0.25 } as const;
    const evaluatedPillars = directPillars.filter((pillar) => pillarAssessments[pillar].score !== null);
    const evaluatedWeight = evaluatedPillars.reduce((sum, pillar) => sum + overallWeights[pillar], 0);
    const observedOverallScore = evaluatedWeight === 0
      ? null
      : Math.round(evaluatedPillars.reduce((sum, pillar) => sum + (pillarAssessments[pillar].score ?? 0) * overallWeights[pillar], 0) / evaluatedWeight);
    const overallAssessment: PillarAssessment = {
      state: observedOverallScore === null ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
      score: observedOverallScore,
      coverage,
      evaluatedCapabilities: evaluatedPillars,
    };

    // Extract top risks and opportunities for quick display
    const topRisks = allSignals
      .filter((s) => s.type === 'risk' || s.type === 'warning')
      .sort((a, b) => a.magnitude - b.magnitude)
      .slice(0, 5);

    const topOpportunities = allSignals
      .filter((s) => s.type === 'opportunity' || s.type === 'positive' || s.type === 'milestone')
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5);

    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      select: {
        updatedAt: true,
        linkedBankAccounts: { select: { connection: { select: { lastSyncAt: true } } } },
      },
    });
    const synchronized = accounts.filter((account) => account.linkedBankAccounts.length > 0);
    const lastSynchronizedAt = synchronized
      .flatMap((account) => account.linkedBankAccounts.map((linked) => linked.connection.lastSyncAt))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const staleAccounts = accounts.filter((account) => {
      const latestSync = account.linkedBankAccounts
        .map((linked) => linked.connection.lastSyncAt)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? account.updatedAt;
      return Date.now() - latestSync.getTime() > 7 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      evaluatedAt: new Date(),
      overall,
      pillars,
      signals: allSignals,
      topRisks,
      topOpportunities,
      history: history.reverse(),
      overallAssessment,
      coverage,
      pillarCoverage,
      pillarAssessments,
      dataFreshness: {
        synchronizedAccounts: synchronized.length,
        manualAccounts: accounts.length - synchronized.length,
        staleAccounts,
        lastSynchronizedAt,
      },
      recentChanges,
      changeWindow,
    };
  }

  /**
   * Records a daily readiness snapshot for the user.
   * Uses upsert to ensure only one snapshot per user per day.
   * @param userId - The authenticated user's ID
   * @param overall - Overall readiness score
   * @param pillars - Individual pillar scores
   */
  async recordSnapshot(userId: string, overall: number, pillars: PillarScores, signals: Signal[] = []): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const snapshot = await this.prisma.readinessSnapshot.upsert({
      where: { userId_recordedAt: { userId, recordedAt: today } },
      create: {
        userId,
        overall,
        protection: pillars.protection,
        provision: pillars.provision,
        preparation: pillars.preparation,
        prosperity: pillars.prosperity,
        peace: pillars.peace,
        recordedAt: today,
      },
      update: {
        overall,
        protection: pillars.protection,
        provision: pillars.provision,
        preparation: pillars.preparation,
        prosperity: pillars.prosperity,
        peace: pillars.peace,
      },
    });

    await this.prisma.$transaction([
      this.prisma.readinessSignal.deleteMany({ where: { snapshotId: snapshot.id } }),
      this.prisma.readinessSignal.createMany({
        data: signals.map((signal) => ({
          userId,
          snapshotId: snapshot.id,
          capabilityId: signal.capabilityId,
          type: signal.type.toUpperCase() as 'RISK' | 'OPPORTUNITY' | 'MILESTONE' | 'WARNING' | 'POSITIVE',
          magnitude: Math.round(signal.magnitude),
          pillar: signal.pillar.toUpperCase() as 'PROTECTION' | 'PROVISION' | 'PREPARATION' | 'PROSPERITY',
          summary: signal.summary,
          weight: signal.weight ?? 1,
          expiresAt: signal.expiresAt ?? null,
        })),
      }),
    ]);
  }

  /**
   * Retrieves historical readiness snapshots for a user.
   * @param userId - The authenticated user's ID
   * @param days - Number of days of history to return
   * @returns Array of snapshots ordered by date ascending
   */
  async getHistory(userId: string, days: number): Promise<ReadinessSnapshot[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const snapshots = await this.prisma.readinessSnapshot.findMany({
      where: {
        userId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });

    return snapshots.map((s) => ({
      overall: s.overall,
      pillars: {
        protection: s.protection,
        provision: s.provision,
        preparation: s.preparation,
        prosperity: s.prosperity,
        peace: s.peace,
      },
      recordedAt: s.recordedAt,
    }));
  }
}
