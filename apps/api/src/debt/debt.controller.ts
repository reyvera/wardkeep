import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { DebtService } from './debt.service';
import { CalculateDebtSchema, CompareDebtSchema } from './dto/calculate-debt.dto';

@Controller('debt')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  /**
   * Calculates a debt payoff schedule using the specified strategy.
   * @param req - The scoped request with body containing debts, strategy, and totalMonthlyPayment
   * @returns The payoff schedule with serialized amounts
   */
  @Post('calculate')
  calculate(@Req() req: ScopedRequest) {
    const result = CalculateDebtSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.calculate(result.data);
  }

  /**
   * Compares multiple debt payoff strategies.
   * @param req - The scoped request with body containing debts, strategies, and totalMonthlyPayment
   * @returns Strategy comparison results
   */
  @Post('compare')
  compare(@Req() req: ScopedRequest) {
    const result = CompareDebtSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.compare(result.data);
  }

  /**
   * Runs a what-if debt simulation (pure computation, no side effects).
   * @param req - The scoped request with body containing debts, strategy, and totalMonthlyPayment
   * @returns The what-if payoff schedule
   */
  @Post('what-if')
  whatIf(@Req() req: ScopedRequest) {
    const result = CalculateDebtSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.whatIf(result.data);
  }
}
