import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { FinancialGoalsService } from './financial-goals.service';

const amount = z.string().regex(/^\d+(\.\d+)?$/).nullable().optional();
const goalSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: amount,
  savedAmount: amount,
  targetDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
const updateSchema = goalSchema.partial().extend({ isActive: z.boolean().optional() });

@Controller('financial-goals')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class FinancialGoalsController {
  constructor(private readonly goals: FinancialGoalsService) {}

  @Get()
  list(@Req() req: ScopedRequest) { return this.goals.list(req.userId!); }

  @Post()
  create(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = goalSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.goals.create(req.userId!, parsed.data);
  }

  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.goals.update(req.userId!, id, parsed.data);
  }

  @Delete(':id')
  remove(@Req() req: ScopedRequest, @Param('id') id: string) { return this.goals.remove(req.userId!, id); }
}
