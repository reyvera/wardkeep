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
import { InvestmentsService } from './investments.service';
const createSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string().trim().min(1).max(32),
  quantity: z.string().regex(/^\d+(\.\d+)?$/),
  costBasis: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
});
const quoteSchema = z.object({
  quotePrice: z.string().regex(/^\d+(\.\d+)?$/),
  quoteSource: z.string().trim().max(80).optional(),
  quoteAsOf: z.string().date(),
});
const updateSchema = z.object({
  quantity: z.string().regex(/^\d+(\.\d+)?$/),
  costBasis: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
});
@Controller('investments')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class InvestmentsController {
  constructor(private readonly service: InvestmentsService) {}
  @Get() list(@Req() req: ScopedRequest) {
    return this.service.list(req.userId!);
  }
  @Post() create(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.create(req.userId!, parsed.data);
  }
  @Delete(':id') remove(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.remove(req.userId!, id);
  }
  @Patch(':id/quote')
  quote(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.recordQuote(req.userId!, id, parsed.data);
  }
  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.service.update(req.userId!, id, parsed.data);
  }
}
