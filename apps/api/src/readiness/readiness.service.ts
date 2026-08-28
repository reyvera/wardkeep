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
import { SignalProvenance, withSignalProvenance } from './signal-provenance';
import { summarizeDataFreshnessByScope } from './data-freshness';
import {
  generateProvisionSignals,
  generateProsperitySignals,
  generateProtectionSignals,
  generatePreparationSignals,
} from './generators';

/** Response shape for the readiness endpoint. */
export interface ReadinessResponse {
  /** The moment Wardkeep derived this readiness response from the available records. */
  evaluatedAt: Date;
  overall: number;
  pillars: PillarScores;
  signals: Array<Signal & { provenance: SignalProvenance }>;
  topRisks: Array<Signal & { provenance: SignalProvenance }>;
  topOpportunities: Array<Signal & { provenance: SignalProvenance }>;
  history: ReadinessSnapshot[];
  trendWindows: Array<{
    days: 7 | 30 | 90;
    delta: number | null;
    comparedTo: Date | null;
    elapsedDays: number | null;
  }>;
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

const EXPLANATION_FACTORS: Record<keyof PillarScores, Array<{ id: string; label: string }>> = {
  protection: [
    { id: 'emergency-fund', label: 'Liquid reserves' },
    { id: 'insurance', label: 'Recorded insurance policies' },
    { id: 'insurance-coverage-target', label: 'Recorded policy coverage targets' },
    { id: 'estate-documents', label: 'Estate-planning review dates' },
    { id: 'emergency-preparedness', label: 'Emergency preparedness checklist' },
    { id: 'household-transitions', label: 'Household transition-plan review dates' },
    { id: 'income-sources', label: 'Recorded income-source reviews' },
    { id: 'secondary-liquidity', label: 'Recorded credit availability' },
    { id: 'fixed-obligations', label: 'Recorded monthly and external commitments' },
    { id: 'dependents', label: 'Dependent planning reviews' },
  ],
  provision: [
    { id: 'budgets', label: 'Budget pace' },
    { id: 'cashflow', label: 'Recorded cash-flow forecast' },
    { id: 'recurring', label: 'Recorded upcoming recurring bills' },
  ],
  preparation: [
    { id: 'planned-expenses', label: 'Recorded planned expenses' },
    { id: 'vehicle-maintenance', label: 'Vehicle maintenance reminders' },
    { id: 'vehicle-lease', label: 'Vehicle lease end dates' },
    { id: 'home-assets', label: 'Home asset lifespan records' },
  ],
  prosperity: [
    { id: 'net-worth', label: 'Recorded net worth' },
    { id: 'debt-to-income', label: 'Recorded debt-to-income ratio' },
  ],
  peace: [{ id: 'derived-peace', label: 'Observed direct readiness pillars' }],
};

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getLastDashboardView(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastDashboardViewedAt: true },
    });
  }

  async recordDashboardView(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastDashboardViewedAt: new Date() },
    });
  }

  /**
   * Records one fresh daily snapshot for every household. This is called by the
   * trusted background worker, not by a browser request, so trend history can
   * continue while a household is away from the Dashboard.
   */
  async recordDailySnapshots(): Promise<{ recorded: number; skipped: number; failed: number }> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let recorded = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const readiness = await this.getReadiness(user.id);
        const observedOverall = readiness.overallAssessment.score;
        if (observedOverall === null) {
          skipped++;
          continue;
        }

        await this.recordSnapshot(user.id, observedOverall, readiness.pillars, readiness.signals);
        recorded++;
      } catch {
        // One malformed household record must not prevent other daily snapshots.
        failed++;
      }
    }

    return { recorded, skipped, failed };
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
    const [provisionSignals, prosperitySignals, protectionSignals, preparationSignals] =
      await Promise.all([
        generateProvisionSignals(this.prisma, userId),
        generateProsperitySignals(this.prisma, userId),
        generateProtectionSignals(this.prisma, userId),
        generatePreparationSignals(this.prisma, userId),
      ]);

    const allSignals: Signal[] = [
      ...provisionSignals,
      ...prosperitySignals,
      ...protectionSignals,
      ...preparationSignals,
    ];

    // Compute pillar scores using the readiness package
    const provision = computePillarScore('provision', allSignals);
    const prosperity = computePillarScore('prosperity', allSignals);
    const protection = computePillarScore('protection', allSignals);
    const preparation = computePillarScore('preparation', allSignals);

    const pillarScoresWithoutPeace = { protection, provision, preparation, prosperity };

    // Fetch enough daily snapshots for both Peace and the Dashboard's 90-day trend.
    const recentSnapshots = await this.prisma.readinessSnapshot.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 90,
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

    const observedPillarScores = Object.fromEntries(
      (Object.keys(pillarScoresWithoutPeace) as Array<keyof typeof pillarScoresWithoutPeace>)
        .filter((pillar) => allSignals.some((signal) => signal.pillar === pillar))
        .map((pillar) => [pillar, pillarScoresWithoutPeace[pillar]]),
    );
    const peace = computePeace(observedPillarScores, history);
    const overall = computeOverallReadiness(pillarScoresWithoutPeace);

    const pillars: PillarScores = {
      ...pillarScoresWithoutPeace,
      peace,
    };
    const comparisonSnapshot = lastViewedAt
      ? await this.prisma.readinessSnapshot.findFirst({
          where: { userId, recordedAt: { lte: lastViewedAt } },
          orderBy: { recordedAt: 'desc' },
        })
      : recentSnapshots[0];
    const changeWindow = comparisonSnapshot
      ? lastViewedAt
        ? 'since_last_visit'
        : 'since_last_snapshot'
      : 'none';
    const previousSignals = comparisonSnapshot
      ? await this.prisma.readinessSignal.findMany({ where: { snapshotId: comparisonSnapshot.id } })
      : [];
    const recentChanges = comparisonSnapshot
      ? (Object.keys(pillars) as Array<keyof PillarScores>)
          .map((pillar) => {
            const changedSignal =
              previousSignals.length === 0
                ? undefined
                : allSignals.find(
                    (signal) =>
                      signal.pillar === pillar &&
                      !previousSignals.some(
                        (previous) =>
                          previous.capabilityId === signal.capabilityId &&
                          previous.type.toLowerCase() === signal.type &&
                          previous.magnitude === Math.round(signal.magnitude),
                      ),
                  );
            return {
              pillar,
              previous: comparisonSnapshot[pillar],
              current: pillars[pillar],
              delta: pillars[pillar] - comparisonSnapshot[pillar],
              comparedTo: comparisonSnapshot.recordedAt,
              reason: changedSignal?.summary ?? null,
            };
          })
          .filter((change) => change.delta !== 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 5)
      : [];

    const directPillars = ['protection', 'provision', 'preparation', 'prosperity'] as const;
    const capabilityTargets: Record<(typeof directPillars)[number], number> = {
      protection: 5,
      provision: 3,
      preparation: 4,
      prosperity: 3,
    };
    const pillarCoverage = Object.fromEntries(
      directPillars.map((pillar) => {
        const evaluated = new Set(
          allSignals
            .filter((signal) => signal.pillar === pillar)
            .map((signal) => signal.capabilityId),
        ).size;
        return [pillar, Math.round(Math.min(1, evaluated / capabilityTargets[pillar]) * 100)];
      }),
    ) as ReadinessResponse['pillarCoverage'];
    const coverage = Math.round(
      directPillars.reduce((sum, pillar) => sum + pillarCoverage[pillar], 0) / directPillars.length,
    );
    const directPillarAssessments = Object.fromEntries(
      directPillars.map((pillar) => {
        const evaluatedCapabilities = [
          ...new Set(
            allSignals
              .filter((signal) => signal.pillar === pillar)
              .map((signal) => signal.capabilityId),
          ),
        ];
        const pillarCoverageValue = pillarCoverage[pillar];
        return [
          pillar,
          {
            state:
              evaluatedCapabilities.length === 0
                ? 'not_evaluated'
                : pillarCoverageValue >= 75
                  ? 'known'
                  : 'partial',
            score: evaluatedCapabilities.length === 0 ? null : pillars[pillar],
            coverage: pillarCoverageValue,
            evaluatedCapabilities,
          } satisfies PillarAssessment,
        ];
      }),
    ) as Record<(typeof directPillars)[number], PillarAssessment>;
    const pillarAssessments: ReadinessResponse['pillarAssessments'] = {
      ...directPillarAssessments,
      peace: {
        state: coverage === 0 ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
        score: coverage === 0 ? null : peace,
        coverage,
        evaluatedCapabilities: directPillars.filter(
          (pillar) => directPillarAssessments[pillar].state !== 'not_evaluated',
        ),
      },
    };
    const overallWeights = {
      protection: 0.25,
      provision: 0.3,
      preparation: 0.2,
      prosperity: 0.25,
    } as const;
    const evaluatedPillars = directPillars.filter(
      (pillar) => pillarAssessments[pillar].score !== null,
    );
    const evaluatedWeight = evaluatedPillars.reduce(
      (sum, pillar) => sum + overallWeights[pillar],
      0,
    );
    const observedOverallScore =
      evaluatedWeight === 0
        ? null
        : Math.round(
            evaluatedPillars.reduce(
              (sum, pillar) =>
                sum + (pillarAssessments[pillar].score ?? 0) * overallWeights[pillar],
              0,
            ) / evaluatedWeight,
          );
    const overallAssessment: PillarAssessment = {
      state: observedOverallScore === null ? 'not_evaluated' : coverage >= 75 ? 'known' : 'partial',
      score: observedOverallScore,
      coverage,
      evaluatedCapabilities: evaluatedPillars,
    };
    const evaluatedAt = new Date();
    const trendWindows: ReadinessResponse['trendWindows'] = ([7, 30, 90] as const).map((days) => {
      const cutoff = new Date(evaluatedAt);
      cutoff.setDate(cutoff.getDate() - days);
      const comparison = recentSnapshots.find((snapshot) => snapshot.recordedAt <= cutoff);

      if (!comparison || observedOverallScore === null) {
        return { days, delta: null, comparedTo: null, elapsedDays: null };
      }

      return {
        days,
        delta: observedOverallScore - comparison.overall,
        comparedTo: comparison.recordedAt,
        elapsedDays: Math.max(
          1,
          Math.round((evaluatedAt.getTime() - comparison.recordedAt.getTime()) / 86_400_000),
        ),
      };
    });

    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      select: {
        type: true,
        linkedBankAccounts: { select: { connection: { select: { lastSyncAt: true } } } },
      },
    });
    const freshnessByScope = summarizeDataFreshnessByScope(
      accounts.map((account) => ({
        type: account.type,
        linkedSyncTimes: account.linkedBankAccounts.map((linked) => linked.connection.lastSyncAt),
      })),
    );
    const signalsWithProvenance = allSignals.map((signal) =>
      withSignalProvenance(signal, freshnessByScope),
    );
    const topRisks = signalsWithProvenance
      .filter((signal) => signal.type === 'risk' || signal.type === 'warning')
      .sort((a, b) => a.magnitude - b.magnitude)
      .slice(0, 5);
    const topOpportunities = signalsWithProvenance
      .filter(
        (signal) =>
          signal.type === 'opportunity' ||
          signal.type === 'positive' ||
          signal.type === 'milestone',
      )
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5);

    return {
      evaluatedAt,
      overall,
      pillars,
      signals: signalsWithProvenance,
      topRisks,
      topOpportunities,
      history: history.reverse(),
      trendWindows,
      overallAssessment,
      coverage,
      pillarCoverage,
      pillarAssessments,
      dataFreshness: freshnessByScope.all,
      recentChanges,
      changeWindow,
    };
  }

  /**
   * Returns an explicit, read-only explanation of the current readiness state.
   * It deliberately does not record a visit, a recommendation, or a snapshot.
   */
  async getExplanation(userId: string) {
    const readiness = await this.getReadiness(userId);
    const pillars = (Object.keys(readiness.pillars) as Array<keyof PillarScores>).map((pillar) => {
      const factors = readiness.signals
        .filter((signal) => signal.pillar === pillar)
        .sort((left, right) => Math.abs(right.magnitude) - Math.abs(left.magnitude));
      const evaluated = new Set(factors.map((factor) => factor.capabilityId));

      return {
        pillar,
        assessment: readiness.pillarAssessments[pillar],
        factors,
        notEvaluated: EXPLANATION_FACTORS[pillar].filter((factor) => !evaluated.has(factor.id)),
      };
    });

    return {
      evaluatedAt: readiness.evaluatedAt,
      overallAssessment: readiness.overallAssessment,
      dataFreshness: readiness.dataFreshness,
      recentChanges: readiness.recentChanges,
      changeWindow: readiness.changeWindow,
      pillars,
    };
  }

  /**
   * Records a daily readiness snapshot for the user.
   * Uses upsert to ensure only one snapshot per user per day.
   * @param userId - The authenticated user's ID
   * @param overall - Overall readiness score
   * @param pillars - Individual pillar scores
   */
  async recordSnapshot(
    userId: string,
    overall: number,
    pillars: PillarScores,
    signals: Signal[] = [],
  ): Promise<void> {
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
          type: signal.type.toUpperCase() as
            'RISK' | 'OPPORTUNITY' | 'MILESTONE' | 'WARNING' | 'POSITIVE',
          magnitude: Math.round(signal.magnitude),
          pillar: signal.pillar.toUpperCase() as
            'PROTECTION' | 'PROVISION' | 'PREPARATION' | 'PROSPERITY',
          summary: signal.summary,
          weight: signal.weight ?? 1,
          expiresAt: signal.expiresAt ?? null,
        })),
      }),
    ]);

    // Keep one year of daily history. Snapshot signals cascade with the snapshot,
    // so pruning does not leave orphaned factor records behind.
    const retentionCutoff = new Date(today);
    retentionCutoff.setUTCDate(retentionCutoff.getUTCDate() - 364);
    await this.prisma.readinessSnapshot.deleteMany({
      where: { userId, recordedAt: { lt: retentionCutoff } },
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
