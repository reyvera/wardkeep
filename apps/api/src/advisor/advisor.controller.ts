import { Controller, Get, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { AdvisorService } from './advisor.service';

@Controller('advisor')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class AdvisorController {
  constructor(private readonly advisor: AdvisorService) {}

  @Get('brief/morning')
  getMorningBrief(@Req() req: ScopedRequest) {
    return this.advisor.getMorningBrief(req.userId!);
  }

  @Get('recommendations')
  getRecommendations(@Req() req: ScopedRequest) {
    return this.advisor.getRecommendations(req.userId!);
  }

  @Get('insights')
  getCrossCapabilityInsights(@Req() req: ScopedRequest) {
    return this.advisor.getCrossCapabilityInsights(req.userId!);
  }

  @Get('brief/weekly')
  getWeeklyBrief(@Req() req: ScopedRequest) {
    return this.advisor.getWeeklyBrief(req.userId!);
  }

  @Get('brief/monthly')
  getMonthlyBrief(@Req() req: ScopedRequest) {
    return this.advisor.getMonthlyBrief(req.userId!);
  }
}
