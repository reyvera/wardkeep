import { BadRequestException, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { ChatRequestSchema } from '../ai-chat/dto/chat.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { AdvisorService } from './advisor.service';
import { AdvisorConversationService } from './advisor-conversation.service';

@Controller('advisor')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class AdvisorController {
  constructor(
    private readonly advisor: AdvisorService,
    private readonly conversation: AdvisorConversationService,
  ) {}

  @Post('conversation')
  respond(@Req() req: ScopedRequest) {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.conversation.respond(req.userId!, parsed.data);
  }

  @Get('conversation/history')
  history(@Req() req: ScopedRequest, @Query('sessionId') sessionId?: string) {
    if (!sessionId) throw new BadRequestException('sessionId query parameter is required');
    return this.conversation.history(req.userId!, sessionId);
  }

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
