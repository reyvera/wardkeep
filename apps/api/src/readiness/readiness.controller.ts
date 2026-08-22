import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { ReadinessService } from './readiness.service';

@Controller('readiness')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

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
    const readiness = await this.readinessService.getReadiness(userId, user?.lastDashboardViewedAt ?? null);

    await this.readinessService.recordDashboardView(userId);

    // Record today's snapshot for historical tracking (fire-and-forget)
    this.readinessService
      .recordSnapshot(userId, readiness.overall, readiness.pillars, readiness.signals)
      .catch(() => {
        // Non-fatal: snapshot persistence failure shouldn't block response
      });

    return readiness;
  }

  /**
   * Returns historical readiness snapshots for trend visualization.
   * @param req - The scoped request with userId
   * @param days - Number of days of history to return (default: 30, max: 90)
   * @returns Array of daily readiness snapshots
   */
  @Get('history')
  async getHistory(
    @Req() req: ScopedRequest,
    @Query('days') daysParam?: string,
  ) {
    const userId = req.userId!;
    const days = Math.min(Math.max(parseInt(daysParam ?? '30', 10) || 30, 1), 90);

    return this.readinessService.getHistory(userId, days);
  }
}
