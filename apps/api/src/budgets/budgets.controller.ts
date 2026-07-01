import {
  BadRequestException,
  Controller,
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
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { BudgetsService } from './budgets.service';
import { CreateBudgetSchema } from './dto/create-budget.dto';
import { UpdateBudgetSchema } from './dto/update-budget.dto';

const CopyBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
});

const MonthParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format');

@Controller('budgets')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  /**
   * Creates a new budget with allocations for a specific month.
   * @param req - The scoped request with userId and body
   * @returns The newly created budget with allocations
   */
  @Post()
  async createBudget(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateBudgetSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.budgetsService.createBudget(userId, result.data);
  }

  /**
   * Copies a budget from the previous month into the specified month.
   * @param req - The scoped request with userId and body containing target month
   * @returns The newly created budget with copied allocations
   */
  @Post('copy')
  async copyBudget(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CopyBudgetSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.budgetsService.copyFromPreviousMonth(userId, result.data.month);
  }

  /**
   * Gets the budget summary for a specific month using the Finance Engine.
   * @param req - The scoped request with userId
   * @param month - Month param in YYYY-MM format
   * @returns Budget summary with totals and per-category progress
   */
  @Get(':month/summary')
  async getBudgetSummary(
    @Req() req: ScopedRequest,
    @Param('month') month: string,
  ) {
    const userId = req.userId!;
    const parsed = MonthParamSchema.safeParse(month);

    if (!parsed.success) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }

    return this.budgetsService.getBudgetSummary(userId, parsed.data);
  }

  /**
   * Retrieves the budget for a specific month.
   * @param req - The scoped request with userId
   * @param month - Month param in YYYY-MM format
   * @returns The budget with allocations for the given month
   */
  @Get(':month')
  async getBudgetByMonth(
    @Req() req: ScopedRequest,
    @Param('month') month: string,
  ) {
    const userId = req.userId!;
    const parsed = MonthParamSchema.safeParse(month);

    if (!parsed.success) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }

    return this.budgetsService.getBudgetByMonth(userId, parsed.data);
  }

  /**
   * Updates allocations for an existing budget.
   * @param req - The scoped request with userId and body
   * @param id - The budget ID from route params
   * @returns The updated budget with new allocations
   */
  @Patch(':id')
  async updateBudget(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    const result = UpdateBudgetSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.budgetsService.updateBudget(userId, id, result.data);
  }
}
