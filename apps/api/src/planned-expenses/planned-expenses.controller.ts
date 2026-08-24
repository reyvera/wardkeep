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
import { PlannedExpensesService } from './planned-expenses.service';
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  fundedAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  dueDate: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});
const updateSchema = z.object({
  fundedAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
@Controller('planned-expenses')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class PlannedExpensesController {
  constructor(private readonly expenses: PlannedExpensesService) {}
  @Get() list(@Req() req: ScopedRequest) {
    return this.expenses.list(req.userId!);
  }
  @Post() create(@Req() req: ScopedRequest) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.expenses.create(req.userId!, parsed.data);
  }
  @Patch(':id') update(@Req() req: ScopedRequest, @Param('id') id: string) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.expenses.update(req.userId!, id, parsed.data);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(
    @Req() req: ScopedRequest,
    @Param('id') id: string,
  ) {
    return this.expenses.remove(req.userId!, id);
  }
}
