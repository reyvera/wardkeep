import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { HouseholdTransitionsService } from './household-transitions.service';

const planSchema = z.object({
  mode: z.enum(['INCAPACITY_CONTINUITY', 'AFTER_DEATH_SETTLEMENT']),
  title: z.string().trim().min(1).max(120),
  reviewDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const contactSchema = z.object({
  role: z.enum(['INCAPACITY_AGENT', 'POTENTIAL_EXECUTOR', 'SURVIVING_HOUSEHOLD_CONTACT']),
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
const trustedAccessInvitationSchema = z.object({
  recipientEmail: z.string().email().max(254),
  scopes: z
    .array(z.enum(['HANDOFF_SUMMARY', 'HOUSEHOLD_MEMBER']))
    .min(1)
    .max(2),
});
const trustedAccessAcceptSchema = z.object({ invitationCode: z.string().min(20).max(200) });
const shareHandoffSummarySchema = z.object({ confirmed: z.literal(true) });
const activateSurvivingHouseholdLeadSchema = z.object({ confirmed: z.literal(true) });

@Controller('household-transitions')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class HouseholdTransitionsController {
  constructor(private readonly service: HouseholdTransitionsService) {}

  @Get('readiness-check')
  readinessCheck(@Req() req: ScopedRequest) {
    return this.service.readinessCheck(req.userId!);
  }

  @Get('household-membership')
  householdMembership(@Req() req: ScopedRequest) {
    return this.service.householdMembership(req.userId!);
  }

  @Get('handoff-summary')
  handoffSummary(@Req() req: ScopedRequest) {
    return this.service.handoffSummary(req.userId!);
  }

  @Post('handoff-summary/share')
  shareHandoffSummary(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = shareHandoffSummarySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Confirm before sharing a handoff summary');
    return this.service.createSharedHandoffSummary(req.userId!);
  }

  @Get('trusted-access')
  listTrustedAccess(@Req() req: ScopedRequest) {
    return this.service.listTrustedAccess(req.userId!);
  }

  @Post('trusted-access/invitations')
  createTrustedAccessInvitation(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = trustedAccessInvitationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.createTrustedAccessInvitation(
      req.userId!,
      parsed.data.recipientEmail,
      parsed.data.scopes,
    );
  }

  @Post('trusted-access/accept')
  acceptTrustedAccessInvitation(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = trustedAccessAcceptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.acceptTrustedAccessInvitation(
      req.userId!,
      req.user!.email,
      parsed.data.invitationCode,
    );
  }

  @Get('trusted-access/handoff-summary')
  sharedHandoffSummary(@Req() req: ScopedRequest) {
    return this.service.sharedHandoffSummary(req.userId!);
  }

  @Post('surviving-household/lead')
  activateSurvivingHouseholdLead(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = activateSurvivingHouseholdLeadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Confirm before starting this transition');
    return this.service.activateSurvivingHouseholdLead(req.userId!);
  }

  @Delete('trusted-access/invitations/:id')
  revokeTrustedAccessInvitation(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.revokeTrustedAccessInvitation(req.userId!, id);
  }

  @Delete('trusted-access/grants/:id')
  revokeTrustedAccessGrant(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.revokeTrustedAccessGrant(req.userId!, id);
  }

  @Get()
  list(@Req() req: ScopedRequest) {
    return this.service.list(req.userId!);
  }

  @Get('contacts')
  listContacts(@Req() req: ScopedRequest) {
    return this.service.listContacts(req.userId!);
  }

  @Post('contacts')
  createContact(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.createContact(req.userId!, parsed.data);
  }

  @Delete('contacts/:id')
  removeContact(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.removeContact(req.userId!, id);
  }

  @Post()
  create(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.create(req.userId!, parsed.data);
  }

  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = planSchema
      .partial()
      .extend({ isActive: z.boolean().optional() })
      .safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.update(req.userId!, id, parsed.data);
  }

  @Delete(':id')
  remove(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.remove(req.userId!, id);
  }
}
