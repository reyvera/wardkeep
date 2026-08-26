import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { TimelineService } from './timeline.service';

@Controller('timeline')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get('upcoming')
  listUpcoming(@Req() req: ScopedRequest, @Query('days') days?: string) {
    const requestedDays = days === undefined ? undefined : Number(days);
    return this.timeline.listUpcoming(req.userId!, requestedDays);
  }

  @Get('history')
  listHistory(@Req() req: ScopedRequest, @Query('days') days?: string) {
    const requestedDays = days === undefined ? undefined : Number(days);
    return this.timeline.listHistory(req.userId!, requestedDays);
  }
}
