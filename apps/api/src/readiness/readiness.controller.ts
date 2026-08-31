import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { READINESS_MODEL_VERSION } from '@wardkeep/readiness';

import { AuthGuard } from '../common/guards/auth.guard';
import { UserScopeInterceptor, ScopedRequest } from '../common/interceptors/user-scope.interceptor';
import { ReadinessService } from './readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

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
