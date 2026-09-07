import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

import {
  computePillarScore,
  computeModel2Overall,
  computePeace,
  Signal,
  PillarScores,
  PillarAssessment,
  READINESS_MODEL_VERSION,
  ActivePillarScores,
  reclassifySignalsForModel2,
  MODEL_2_EFFECTIVE_DATE,
  MODEL_2_PILLAR_WEIGHTS,
  ReadinessSnapshot,
} from '@wardkeep/readiness';

import { PrismaService } from '../prisma/prisma.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { SignalProvenance, withSignalProvenance } from './signal-provenance';
import { summarizeDataFreshnessByScope } from './data-freshness';
import {
  generateProvisionSignals,
  generateProsperitySignals,
  generateProtectionSignals,
  generatePreparationSignals,
} from './generators';
import { calculateRecordedNetWorth } from './generators/prosperity.generator';
import { deriveDurableReadinessChanges } from './readiness-change';
import { buildPillarTrends, PillarTrend } from './readiness-trends';
import { evaluateReadinessScenario, ScenarioChange } from './readiness-scenario';
import { calculateEmergencyFundBurnRate, emergencyFundSignal } from './generators/protection.generator';

/** Response shape for the readiness endpoint. */
export interface ReadinessResponse {
  /** The moment Wardkeep derived this readiness response from the available records. */
  evaluatedAt: Date;
  /** Deterministic scoring contract used for this response and its history. */
  modelVersion: number;
  model: {
    effectiveDate: string;
    directWeights: typeof MODEL_2_PILLAR_WEIGHTS;
    peaceIsDerived: true;
  };
  overall: number;
  pillars: ActivePillarScores;
  signals: Array<Signal & { provenance: SignalProvenance }>;
  topRisks: Array<Signal & { provenance: SignalProvenance }>;
  topOpportunities: Array<Signal & { provenance: SignalProvenance }>;
  history: Array<Omit<ReadinessSnapshot, 'pillars'> & { pillars: ActivePillarScores }>;
  trendWindows: Array<{
    days: 7 | 30 | 90;
    delta: number | null;
    comparedTo: Date | null;
    elapsedDays: number | null;
  }>;
  pillarTrends: Record<keyof ActivePillarScores, PillarTrend>;
  overallAssessment: PillarAssessment;
  coverage: number;
  pillarCoverage: Record<Exclude<keyof ActivePillarScores, 'peace'>, number>;
  pillarAssessments: Record<keyof ActivePillarScores, PillarAssessment>;
  dataFreshness: {
    synchronizedAccounts: number;
    manualAccounts: number;
    staleAccounts: number;
    lastSynchronizedAt: Date | null;
  };
  recentChanges: Array<{
    pillar: keyof ActivePillarScores;
    previous: number;
    current: number;
    delta: number;
    comparedTo: Date;
    reason: string | null;
  }>;
  changeWindow: 'since_last_visit' | 'since_last_snapshot' | 'none';
}

const EXPLANATION_FACTORS: Record<
  keyof ActivePillarScores,
  Array<{ id: string; label: string }>
> = {
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
  prosperity: [
    { id: 'net-worth', label: 'Recorded net worth' },
    { id: 'debt-to-income', label: 'Recorded debt-to-income ratio' },
  ],
  peace: [
    { id: 'derived-peace', label: 'Observed direct readiness pillars' },
    { id: 'vehicle-maintenance', label: 'Vehicle maintenance reminders' },
  ],
};

/** The database retains the model-1 column so historical records remain readable. */
function asLegacyPillars(pillars: ActivePillarScores): PillarScores {
  return { ...pillars, preparation: 0 };
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async getLastDashboardView(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastDashboardViewedAt: true },
    });
  }

  /** Computes an explicit, non-persistent what-if comparison from current evidence. */
  async getScenario(userId: string, changes: ScenarioChange[]) {
    return evaluateReadinessScenario(await this.getReadiness(userId), changes);
  }

  /**
   * Compares one explicit liquid-reserve amount using the same recorded
   * 90-day burn-rate evidence as the live emergency-fund signal. The entered
   * amount is never written to an account or used outside this response.
   */
  async getCashReserveScenario(userId: string, proposedReserves: string) {
    const current = await this.getReadiness(userId);
    if (!current.signals.some((signal) => signal.capabilityId === 'emergency-fund')) {
      throw new Error('Liquid-reserve coverage is not currently evaluated');
    }
    const reserves = new Decimal(proposedReserves);
    const replacement = emergencyFundSignal(
      reserves,
      await calculateEmergencyFundBurnRate(this.prisma, userId),
    )[0];
    if (!replacement) throw new Error('Liquid-reserve comparison is unavailable');
    return {
      ...evaluateReadinessScenario(current, [
        { operation: 'replace', capabilityId: 'emergency-fund', signal: replacement },
      ]),
      builder: {
        kind: 'cash_reserves',
        proposedReserves: reserves.toFixed(2),
        sourceRecords: ['Current checking, savings, and cash account balances', 'Recorded 90-day expenses'],
        assumptions: [
          'The entered reserve amount temporarily replaces the recorded liquid-reserve total only.',
          'The recorded expense window and its transfer, refund, and one-time exclusions are unchanged.',
        ],
      },
    };
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
   * Records an updated current-day snapshot after a readiness-relevant write.
   * A failed refresh never invalidates the already-committed household change;
   * the scheduled daily job remains the recovery path.
   */
  async refreshAfterRelevantWrite(userId: string): Promise<void> {
    try {
      const readiness = await this.getReadiness(userId);
      const observedOverall = readiness.overallAssessment.score;
      if (observedOverall !== null) {
        await this.recordSnapshot(userId, observedOverall, readiness.pillars, readiness.signals);
      }
    } catch {
      // Snapshot refresh is deliberately best-effort after a successful write.
    }
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

    const publishedSignals: Signal[] = [
      ...provisionSignals,
      ...prosperitySignals,
      ...protectionSignals,
      ...preparationSignals,
    ];
    const allSignals = reclassifySignalsForModel2(
      await this.capabilities.publishedSignalsForUser(userId, publishedSignals),
    ) as Signal[];

    // Compute pillar scores using the readiness package
    const provision = computePillarScore('provision', allSignals);
    const prosperity = computePillarScore('prosperity', allSignals);
    const protection = computePillarScore('protection', allSignals);
    const pillarScoresWithoutPeace = { protection, provision, prosperity };

    // Fetch enough daily snapshots for both Peace and the Dashboard's 90-day trend.
    const recentSnapshots = await this.prisma.readinessSnapshot.findMany({
      where: { userId, modelVersion: READINESS_MODEL_VERSION },
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
      modelVersion: s.modelVersion,
    }));

    const activeHistory = history.map(({ pillars: historicalPillars, ...snapshot }) => ({
      ...snapshot,
      pillars: {
        protection: historicalPillars.protection,
        provision: historicalPillars.provision,
        prosperity: historicalPillars.prosperity,
        peace: historicalPillars.peace,
      },
    }));

    const observedPillarScores = Object.fromEntries(
      (Object.keys(pillarScoresWithoutPeace) as Array<keyof typeof pillarScoresWithoutPeace>)
        .filter((pillar) => allSignals.some((signal) => signal.pillar === pillar))
        .map((pillar) => [pillar, pillarScoresWithoutPeace[pillar]]),
    );
    const peace = computePeace(
      observedPillarScores,
      history,
      allSignals.filter((signal) => signal.pillar === 'peace'),
    );
    const overall = computeModel2Overall(pillarScoresWithoutPeace);

    const pillars: ActivePillarScores = {
      ...pillarScoresWithoutPeace,
      peace,
    };
    const comparisonSnapshot = lastViewedAt
      ? await this.prisma.readinessSnapshot.findFirst({
          where: {
            userId,
            modelVersion: READINESS_MODEL_VERSION,
            recordedAt: { lte: lastViewedAt },
          },
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
      ? (Object.keys(pillars) as Array<keyof ActivePillarScores>)
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

    const directPillars = ['protection', 'provision', 'prosperity'] as const;
    const capabilityTargets: Record<(typeof directPillars)[number], number> = {
      protection: 5,
      provision: 3,
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
    const overallWeights = { protection: 0.35, provision: 0.35, prosperity: 0.3 } as const;
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
    const pillarTrends = buildPillarTrends(
      { ...pillars, preparation: 0 },
      history,
      evaluatedAt,
    ) as Record<keyof ActivePillarScores, PillarTrend>;

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
      modelVersion: READINESS_MODEL_VERSION,
      model: {
        effectiveDate: MODEL_2_EFFECTIVE_DATE,
        directWeights: MODEL_2_PILLAR_WEIGHTS,
        peaceIsDerived: true,
      },
      overall,
      pillars,
      signals: signalsWithProvenance,
      topRisks,
      topOpportunities,
      history: activeHistory.reverse(),
      trendWindows,
      pillarTrends,
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
    const pillars = (Object.keys(readiness.pillars) as Array<keyof ActivePillarScores>).map(
      (pillar) => {
        const scoredFactors = readiness.signals
          .filter((signal) => signal.pillar === pillar)
          .sort((left, right) => Math.abs(right.magnitude) - Math.abs(left.magnitude));
        const factors =
          pillar === 'peace' && readiness.pillarAssessments.peace.score !== null
            ? [
                {
                  capabilityId: 'derived-peace',
                  type: 'milestone' as const,
                  magnitude: 0,
                  pillar: 'peace' as const,
                  summary:
                    'Peace is derived from the least-secure directly evaluated pillar, recent readiness stability, and recorded household administration that needs attention.',
                },
                ...scoredFactors,
              ]
            : scoredFactors;
        const evaluated = new Set(factors.map((factor) => factor.capabilityId));

        return {
          pillar,
          assessment: readiness.pillarAssessments[pillar],
          factors,
          notEvaluated: EXPLANATION_FACTORS[pillar].filter((factor) => !evaluated.has(factor.id)),
        };
      },
    );

    return {
      evaluatedAt: readiness.evaluatedAt,
      overallAssessment: readiness.overallAssessment,
      dataFreshness: readiness.dataFreshness,
      recentChanges: readiness.recentChanges,
      changeWindow: readiness.changeWindow,
      pillarTrends: readiness.pillarTrends,
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
    pillars: ActivePillarScores,
    signals: Signal[] = [],
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const netWorth = await calculateRecordedNetWorth(this.prisma, userId);
    const observationContext = { householdId: userId, evaluatedAt: today };
    const observations = (
      await Promise.all(
        (await this.capabilities.enabledForUser(userId)).map((capability) =>
          capability.observations(observationContext),
        ),
      )
    ).flat();

    const previousSnapshot = await this.prisma.readinessSnapshot.findFirst({
      where: {
        userId,
        modelVersion: READINESS_MODEL_VERSION,
        recordedAt: { lt: today },
      },
      include: { signals: true },
      orderBy: { recordedAt: 'desc' },
    });

    const snapshot = await this.prisma.readinessSnapshot.upsert({
      where: {
        userId_recordedAt_modelVersion: {
          userId,
          recordedAt: today,
          modelVersion: READINESS_MODEL_VERSION,
        },
      },
      create: {
        userId,
        modelVersion: READINESS_MODEL_VERSION,
        overall,
        protection: pillars.protection,
        provision: pillars.provision,
        preparation: 0,
        prosperity: pillars.prosperity,
        peace: pillars.peace,
        netWorth,
        recordedAt: today,
      },
      update: {
        overall,
        protection: pillars.protection,
        provision: pillars.provision,
        preparation: 0,
        prosperity: pillars.prosperity,
        peace: pillars.peace,
        netWorth,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.readinessSignal.deleteMany({ where: { snapshotId: snapshot.id } });
      await tx.readinessObservation.deleteMany({ where: { snapshotId: snapshot.id } });
      await tx.readinessScoreChange.deleteMany({ where: { snapshotId: snapshot.id } });

      await tx.readinessObservation.createMany({
        data: observations.map((observation) => ({
          userId,
          snapshotId: snapshot.id,
          capabilityId: observation.capabilityId,
          fact: observation.fact,
          value: observation.value as Prisma.InputJsonValue,
          confidence: observation.confidence,
          observedAt: observation.observedAt,
        })),
      });
      const signalObservations = await Promise.all(
        signals.map((signal) =>
          tx.readinessObservation.create({
            data: {
              userId,
              snapshotId: snapshot.id,
              capabilityId: signal.capabilityId,
              fact: `Readiness signal: ${signal.summary}`,
              value: {
                type: signal.type,
                magnitude: Math.round(signal.magnitude),
                pillar: signal.pillar,
                weight: signal.weight ?? 1,
                relevanceDate: signal.relevanceDate?.toISOString() ?? null,
              },
              confidence: 1,
              observedAt: today,
            },
            select: { id: true },
          }),
        ),
      );
      await tx.readinessSignal.createMany({
        data: signals.map((signal, index) => ({
          userId,
          snapshotId: snapshot.id,
          observationId: signalObservations[index].id,
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
      });
      if (previousSnapshot) {
        await tx.readinessScoreChange.createMany({
          data: deriveDurableReadinessChanges(
            {
              protection: previousSnapshot.protection,
              provision: previousSnapshot.provision,
              preparation: previousSnapshot.preparation,
              prosperity: previousSnapshot.prosperity,
              peace: previousSnapshot.peace,
            },
            asLegacyPillars(pillars),
            previousSnapshot.signals,
            signals,
          ).map((change) => ({
            snapshotId: snapshot.id,
            pillar: change.pillar.toUpperCase() as
              'PROTECTION' | 'PROVISION' | 'PREPARATION' | 'PROSPERITY' | 'PEACE',
            previous: change.previous,
            current: change.current,
            delta: change.delta,
            reason: change.reason,
            evidence: change.evidence as Prisma.InputJsonValue,
          })),
        });
      }
    });

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
  async getHistory(
    userId: string,
    days: number,
    modelVersion: number = READINESS_MODEL_VERSION,
  ): Promise<
    Array<
      ReadinessSnapshot | (Omit<ReadinessSnapshot, 'pillars'> & { pillars: ActivePillarScores })
    >
  > {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const snapshots = await this.prisma.readinessSnapshot.findMany({
      where: {
        userId,
        modelVersion,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });

    return snapshots.map((s) => {
      const snapshot = {
        overall: s.overall,
        pillars: {
          protection: s.protection,
          provision: s.provision,
          preparation: s.preparation,
          prosperity: s.prosperity,
          peace: s.peace,
        },
        recordedAt: s.recordedAt,
        modelVersion: s.modelVersion,
      } satisfies ReadinessSnapshot;
      if (modelVersion !== READINESS_MODEL_VERSION) return snapshot;
      const activePillars = {
        protection: snapshot.pillars.protection,
        provision: snapshot.pillars.provision,
        prosperity: snapshot.pillars.prosperity,
        peace: snapshot.pillars.peace,
      };
      return { ...snapshot, pillars: activePillars };
    });
  }

  /** Lists independently comparable deterministic readiness-history series for a household. */
  async getHistoryModelVersions(userId: string) {
    const versions = await this.prisma.readinessSnapshot.groupBy({
      by: ['modelVersion'],
      where: { userId },
      _count: { id: true },
      _min: { recordedAt: true },
      _max: { recordedAt: true },
      orderBy: { modelVersion: 'desc' },
    });
    return versions.map((version) => ({
      modelVersion: version.modelVersion,
      snapshotCount: version._count.id,
      firstRecordedAt: version._min.recordedAt,
      lastRecordedAt: version._max.recordedAt,
      isActive: version.modelVersion === READINESS_MODEL_VERSION,
    }));
  }

  /**
   * Returns recorded capability facts for recent snapshots, including the
   * persisted scored signal that cites each signal-observation as its source.
   */
  async getObservations(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setUTCHours(0, 0, 0, 0);
    return this.prisma.readinessObservation.findMany({
      where: { userId, observedAt: { gte: since } },
      select: {
        capabilityId: true,
        fact: true,
        value: true,
        confidence: true,
        observedAt: true,
        snapshot: { select: { recordedAt: true } },
        signals: {
          select: {
            id: true,
            capabilityId: true,
            type: true,
            pillar: true,
            magnitude: true,
            summary: true,
          },
        },
      },
      orderBy: [{ observedAt: 'desc' }, { capabilityId: 'asc' }, { fact: 'asc' }],
    });
  }
}
