import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RecommendationsService } from './recommendations.service';

const UpdateRecommendationStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISMISSED', 'COMPLETED']),
});

@Controller('recommendations')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  list(@Req() req: ScopedRequest) {
    return this.recommendations.list(req.userId!);
  }

  @Patch(':id')
  updateStatus(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateRecommendationStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.recommendations.updateStatus(req.userId!, id, parsed.data.status);
  }
}
