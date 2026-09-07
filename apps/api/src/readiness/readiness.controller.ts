import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { READINESS_MODEL_VERSION } from '@wardkeep/readiness';

import { AuthGuard } from '../common/guards/auth.guard';
import { UserScopeInterceptor, ScopedRequest } from '../common/interceptors/user-scope.interceptor';
import { ReadinessService } from './readiness.service';
import { ScenarioChange } from './readiness-scenario';
import { RecommendationsService } from '../recommendations/recommendations.service';

const scenarioSignalSchema = z.object({
  capabilityId: z.string().trim().min(1).max(80),
  pillar: z.enum(['protection', 'provision', 'prosperity']),
  type: z.enum(['risk', 'opportunity', 'milestone', 'warning', 'positive']),
  magnitude: z.number().finite().min(-10).max(10),
  summary: z.string().trim().min(1).max(500),
  weight: z.number().finite().positive().max(10).optional(),
});
const scenarioSchema = z.object({
  changes: z
    .array(
      z.discriminatedUnion('operation', [
        z.object({
          operation: z.literal('remove'),
          capabilityId: z.string().trim().min(1).max(80),
        }),
        z.object({
          operation: z.literal('replace'),
          capabilityId: z.string().trim().min(1).max(80),
          signal: scenarioSignalSchema,
        }),
      ]),
    )
    .min(1)
    .max(10),
});
const cashReserveScenarioSchema = z.object({
  proposedReserves: z.coerce.number().finite().min(0).max(100_000_000),
});
const recurringObligationScenarioSchema = z.object({
  proposedMonthlyRecurringBills: z.coerce.number().finite().min(0).max(10_000_000),
});
const debtMinimumScenarioSchema = z.object({
  proposedMonthlyDebtMinimums: z.coerce.number().finite().min(0).max(10_000_000),
});

@Controller('readiness')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class ReadinessController {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly recommendations: RecommendationsService,
  ) {}

  /**
   * Returns the current readiness state for the authenticated user.
   * Includes overall score, pillar scores, signals, top risks, and history.
   * Also records a daily snapshot for trend tracking.
   * @param req - The scoped request with userId
   * @returns Full readiness response
   */
  @Get()
  async getReadiness(@Req() req: ScopedRequest) {
    const userId = req.userId!;

    const user = await this.readinessService.getLastDashboardView(userId);
    const readiness = await this.readinessService.getReadiness(
      userId,
      user?.lastDashboardViewedAt ?? null,
    );

    await this.recommendations.synchronize(userId, readiness.signals);

    await this.readinessService.recordDashboardView(userId);

    // Record today's observed score for historical tracking (fire-and-forget).
    // Do not persist a synthetic overall when no direct pillar can be evaluated.
    if (readiness.overallAssessment.score !== null) {
      this.readinessService
        .recordSnapshot(
          userId,
          readiness.overallAssessment.score,
          readiness.pillars,
          readiness.signals,
        )
        .catch(() => {
          // Non-fatal: snapshot persistence failure shouldn't block response
        });
    }

    return readiness;
  }

  /** Returns a read-only deterministic readiness comparison; it never writes household data. */
  @Post('scenario')
  getScenario(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = scenarioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.readinessService.getScenario(req.userId!, parsed.data.changes as ScenarioChange[]);
  }

  /** Builds a temporary cash-reserves comparison from current recorded evidence. */
  @Post('scenario/cash-reserves')
  getCashReserveScenario(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = cashReserveScenarioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.readinessService.getCashReserveScenario(
      req.userId!,
      parsed.data.proposedReserves.toFixed(2),
    );
  }

  @Post('scenario/recurring-obligations')
  getRecurringObligationScenario(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = recurringObligationScenarioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.readinessService.getRecurringObligationScenario(
      req.userId!,
      parsed.data.proposedMonthlyRecurringBills.toFixed(2),
    );
  }

  @Post('scenario/debt-minimums')
  getDebtMinimumScenario(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = debtMinimumScenarioSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.readinessService.getDebtMinimumScenario(
      req.userId!,
      parsed.data.proposedMonthlyDebtMinimums.toFixed(2),
    );
  }

  /**
   * Returns historical readiness snapshots for trend visualization.
   * @param req - The scoped request with userId
   * @param days - Number of days of history to return (default: 30, max: 365)
   * @param modelVersion - Optional deterministic scoring model version for legacy history
   * @returns Array of daily readiness snapshots
   */
  @Get('history')
  async getHistory(
    @Req() req: ScopedRequest,
    @Query('days') daysParam?: string,
    @Query('modelVersion') modelVersionParam?: string,
  ) {
    const userId = req.userId!;
    const days = Math.min(Math.max(parseInt(daysParam ?? '30', 10) || 30, 1), 365);
    const modelVersion =
      modelVersionParam === undefined ? READINESS_MODEL_VERSION : Number(modelVersionParam);
    if (!Number.isInteger(modelVersion) || modelVersion < 1) {
      throw new BadRequestException('modelVersion must be a positive integer');
    }

    return this.readinessService.getHistory(userId, days, modelVersion);
  }

  /** Lists the separate readiness scoring-model histories available to this household. */
  @Get('history/models')
  getHistoryModelVersions(@Req() req: ScopedRequest) {
    return this.readinessService.getHistoryModelVersions(req.userId!);
  }

  /** Returns recent household facts and any scored signal that cites each fact. */
  @Get('observations')
  getObservations(@Req() req: ScopedRequest, @Query('days') daysParam?: string) {
    const days = Math.min(Math.max(parseInt(daysParam ?? '30', 10) || 30, 1), 365);
    return this.readinessService.getObservations(req.userId!, days);
  }

  /**
   * Explains each score with its evaluated factor evidence and factors Wardkeep
   * did not evaluate. Unlike the Dashboard endpoint, this is read-only.
   */
  @Get('explain')
  getExplanation(@Req() req: ScopedRequest) {
    return this.readinessService.getExplanation(req.userId!);
  }
}
