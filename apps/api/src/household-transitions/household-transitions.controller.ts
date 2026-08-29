import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { HouseholdTransitionsService } from './household-transitions.service';

const planSchema = z.object({
  mode: z.enum(['INCAPACITY_CONTINUITY', 'AFTER_DEATH_SETTLEMENT']),
  title: z.string().trim().min(1).max(120),
  reviewDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const contactSchema = z.object({ role: z.enum(['INCAPACITY_AGENT', 'POTENTIAL_EXECUTOR', 'SURVIVING_HOUSEHOLD_CONTACT']), name: z.string().trim().min(1).max(120), email: z.string().email().max(254).nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), notes: z.string().trim().max(1000).nullable().optional() });

@Controller('household-transitions')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class HouseholdTransitionsController {
  constructor(private readonly service: HouseholdTransitionsService) {}

  @Get('readiness-check')
  readinessCheck(@Req() req: ScopedRequest) { return this.service.readinessCheck(req.userId!); }

  @Get()
  list(@Req() req: ScopedRequest) { return this.service.list(req.userId!); }

  @Get('contacts')
  listContacts(@Req() req: ScopedRequest) { return this.service.listContacts(req.userId!); }

  @Post('contacts')
  createContact(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.createContact(req.userId!, parsed.data);
  }

  @Delete('contacts/:id')
  removeContact(@Req() req: ScopedRequest, @Param('id') id: string) { return this.service.removeContact(req.userId!, id); }

  @Post()
  create(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.create(req.userId!, parsed.data);
  }

  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = planSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.update(req.userId!, id, parsed.data);
  }

  @Delete(':id')
  remove(@Req() req: ScopedRequest, @Param('id') id: string) { return this.service.remove(req.userId!, id); }
}
