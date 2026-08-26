import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { HouseholdObligationsService } from './household-obligations.service';

const money = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid positive decimal amount');
const base = z.object({
  name: z.string().trim().min(1).max(100),
  monthlyAmount: money,
  isVariable: z.boolean().optional(),
  reviewDate: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});
const update = base.partial().extend({
  reviewDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

@Controller('household-obligations')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class HouseholdObligationsController {
  constructor(private readonly obligations: HouseholdObligationsService) {}

  @Get()
  list(@Req() req: ScopedRequest) {
    return this.obligations.list(req.userId!);
  }

  @Post()
  create(@Req() req: ScopedRequest) {
    const parsed = base.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.obligations.create(req.userId!, parsed.data);
  }

  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string) {
    const parsed = update.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.obligations.update(req.userId!, id, parsed.data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.obligations.remove(req.userId!, id);
  }
}
