import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RealEstateService } from './real-estate.service';
const profileSchema = z.object({
  recordedValue: z.string().regex(/^\d+(\.\d+)?$/),
  valuationDate: z.string().date(),
  mortgageAccountId: z.string().uuid().nullable().optional(),
});
@Controller('real-estate')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RealEstateController {
  constructor(private readonly service: RealEstateService) {}
  @Get()
  list(@Req() req: ScopedRequest) {
    return this.service.list(req.userId!);
  }
  @Get(':accountId/equity') equity(
    @Req() req: ScopedRequest,
    @Param('accountId') accountId: string,
  ) {
    return this.service.equity(req.userId!, accountId);
  }
  @Put(':accountId')
  profile(@Req() req: ScopedRequest, @Param('accountId') accountId: string, @Body() body: unknown) {
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.upsert(req.userId!, accountId, parsed.data);
  }
  @Delete(':accountId')
  remove(@Req() req: ScopedRequest, @Param('accountId') accountId: string) {
    return this.service.remove(req.userId!, accountId);
  }
}
