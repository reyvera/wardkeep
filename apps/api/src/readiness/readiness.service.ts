import { Injectable } from '@nestjs/common';

import {
  computePillarScore,
  computeOverallReadiness,
  computePeace,
  Signal,
  PillarScores,
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
    const preparation = 100; // No generators for this pillar yet

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

    // Extract top risks and opportunities for quick display
    const topRisks = allSignals
      .filter((s) => s.type === 'risk' || s.type === 'warning')
      .sort((a, b) => a.magnitude - b.magnitude)
      .slice(0, 5);

    const topOpportunities = allSignals
      .filter((s) => s.type === 'opportunity' || s.type === 'positive' || s.type === 'milestone')
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5);

    return {
      overall,
      pillars,
      signals: allSignals,
      topRisks,
      topOpportunities,
      history: history.reverse(),
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
