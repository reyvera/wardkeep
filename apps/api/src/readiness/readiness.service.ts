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
  overall: number;
  pillars: PillarScores;
  signals: Signal[];
  topRisks: Signal[];
  topOpportunities: Signal[];
  history: ReadinessSnapshot[];
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
  }>;
}

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes the full readiness state for a user.
   * Collects signals from all generators, scores each pillar,
   * computes overall readiness and Peace, and returns the full picture.
   * @param userId - The authenticated user's ID
   * @returns Complete readiness response with scores, signals, and history
   */
  async getReadiness(userId: string): Promise<ReadinessResponse> {
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
    const latestSnapshot = recentSnapshots[0];
    const recentChanges = latestSnapshot
      ? (Object.keys(pillars) as Array<keyof PillarScores>)
        .map((pillar) => ({
          pillar,
          previous: latestSnapshot[pillar],
          current: pillars[pillar],
          delta: pillars[pillar] - latestSnapshot[pillar],
          comparedTo: latestSnapshot.recordedAt,
        }))
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
    const pillarAssessments = Object.fromEntries(directPillars.map((pillar) => {
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
    })) as Pick<ReadinessResponse['pillarAssessments'], (typeof directPillars)[number]>;
    pillarAssessments.peace = {
      state: coverage === 0 ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
      score: coverage === 0 ? null : peace,
      coverage,
      evaluatedCapabilities: directPillars.filter((pillar) => pillarAssessments[pillar].state !== 'not_evaluated'),
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
      overall,
      pillars,
      signals: allSignals,
      topRisks,
      topOpportunities,
      history: history.reverse(),
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
    };
  }

  /**
   * Records a daily readiness snapshot for the user.
   * Uses upsert to ensure only one snapshot per user per day.
   * @param userId - The authenticated user's ID
   * @param overall - Overall readiness score
   * @param pillars - Individual pillar scores
   */
  async recordSnapshot(userId: string, overall: number, pillars: PillarScores): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await this.prisma.readinessSnapshot.upsert({
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
