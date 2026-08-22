import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { CreateInsurancePolicySchema, UpdateInsurancePolicySchema } from './dto/insurance-policy.dto';
import { InsuranceService } from './insurance.service';

@Controller('insurance/policies')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}
  @Get() list(@Req() req: ScopedRequest) { return this.insurance.list(req.userId!); }
  @Post() create(@Req() req: ScopedRequest) { const parsed = CreateInsurancePolicySchema.safeParse(req.body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors); return this.insurance.create(req.userId!, parsed.data); }
  @Patch(':id') update(@Req() req: ScopedRequest, @Param('id') id: string) { const parsed = UpdateInsurancePolicySchema.safeParse(req.body); if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors); return this.insurance.update(req.userId!, id, parsed.data); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Req() req: ScopedRequest, @Param('id') id: string) { return this.insurance.remove(req.userId!, id); }
}
