import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdvisorMemoryKind } from '@prisma/client';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { AdvisorMemoryService } from './advisor-memory.service';

const memorySchema = z.object({
  kind: z.nativeEnum(AdvisorMemoryKind),
  summary: z.string().trim().min(1).max(1000),
  sourceRefs: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  observedAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).refine((value) => !value.expiresAt || !value.observedAt || new Date(value.expiresAt) > new Date(value.observedAt), {
  message: 'expiresAt must be after observedAt', path: ['expiresAt'],
});

@Controller('advisor/memory')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class AdvisorMemoryController {
  constructor(private readonly memory: AdvisorMemoryService) {}

  @Get()
  list(@Req() request: ScopedRequest) { return this.memory.list(request.userId!); }

  @Post()
  create(@Req() request: ScopedRequest, @Body() body: unknown) {
    const parsed = memorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.memory.create(request.userId!, {
      ...parsed.data,
      observedAt: parsed.data.observedAt ? new Date(parsed.data.observedAt) : undefined,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });
  }

  @Delete(':id')
  remove(@Req() request: ScopedRequest, @Param('id') id: string) {
    if (!z.string().uuid().safeParse(id).success) throw new BadRequestException('id must be a valid UUID');
    return this.memory.remove(request.userId!, id);
  }
}
