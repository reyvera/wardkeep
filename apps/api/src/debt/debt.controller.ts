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

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { DebtService } from './debt.service';
import {
  CalculateDebtSchema,
  CompareDebtSchema,
  ConsolidationSchema,
  VelocityBankingSchema,
  MinimumOnlySchema,
} from './dto/calculate-debt.dto';
import {
  CreateDebtProfileSchema,
  UpdateDebtProfileSchema,
  CreatePayoffPlanSchema,
} from './dto/debt-profile.dto';

@Controller('debt')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  // ─── Debt Profiles ────────────────────────────────────────────────────────

  /**
   * Lists all debt profiles for the authenticated user.
   * Returns profiles with linked account data and computed current balances.
   * @param req - The scoped request with userId
   * @returns Array of debt profiles with account details
   */
  @Get('profiles')
  async listProfiles(@Req() req: ScopedRequest) {
    return this.debtService.listProfiles(req.userId!);
  }

  /**
   * Creates a new debt profile linked to a liability account.
   * @param req - The scoped request with userId and body
   * @returns The newly created debt profile
   */
  @Post('profiles')
  async createProfile(@Req() req: ScopedRequest) {
    const result = CreateDebtProfileSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.createProfile(req.userId!, result.data);
  }

  /**
   * Updates an existing debt profile (APR, minimum payment, or priority).
   * @param req - The scoped request with userId and body
   * @param id - The debt profile ID from route params
   * @returns The updated debt profile
   */
  @Patch('profiles/:id')
  async updateProfile(@Req() req: ScopedRequest, @Param('id') id: string) {
    const result = UpdateDebtProfileSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.updateProfile(req.userId!, id, result.data);
  }

  /**
   * Deletes a debt profile.
   * @param req - The scoped request with userId
   * @param id - The debt profile ID from route params
   */
  @Delete('profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProfile(@Req() req: ScopedRequest, @Param('id') id: string) {
    await this.debtService.deleteProfile(req.userId!, id);
  }

  // ─── Auto-Sync: Debts from Accounts ──────────────────────────────────────

  /**
   * Returns all debt-type accounts with their profiles in the format
   * expected by the payoff calculator. Balances are computed live.
   * @param req - The scoped request with userId
   * @returns Array of debts ready for the calculator
   */
  @Get('from-accounts')
  async getDebtsFromAccounts(@Req() req: ScopedRequest) {
    return this.debtService.getDebtsFromAccounts(req.userId!);
  }

  // ─── Saved Payoff Plans ───────────────────────────────────────────────────

  /**
   * Lists all saved payoff plans for the authenticated user.
   * @param req - The scoped request with userId
   * @returns Array of saved plans ordered by creation date
   */
  @Get('plans')
  async listPlans(@Req() req: ScopedRequest) {
    return this.debtService.listPlans(req.userId!);
  }

  /**
   * Saves a new payoff plan with selected accounts, strategy, and results.
   * @param req - The scoped request with userId and body
   * @returns The saved plan
   */
  @Post('plans')
  async createPlan(@Req() req: ScopedRequest) {
    const result = CreatePayoffPlanSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.createPlan(req.userId!, result.data);
  }

  /**
   * Deletes a saved payoff plan.
   * @param req - The scoped request with userId
   * @param id - The plan ID from route params
   */
  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Req() req: ScopedRequest, @Param('id') id: string) {
    await this.debtService.deletePlan(req.userId!, id);
  }

  // ─── Payoff Calculations ──────────────────────────────────────────────────

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

  // ─── Advanced Strategies ──────────────────────────────────────────────────

  /**
   * Calculates a debt consolidation scenario.
   * Models combining all debts into a single fixed-rate loan at the given APR/term.
   * @param req - The scoped request with body containing debts and consolidation params
   * @returns Consolidation result with schedule and savings vs. baseline
   */
  @Post('consolidation')
  consolidation(@Req() req: ScopedRequest) {
    const result = ConsolidationSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.consolidation(result.data);
  }

  /**
   * Calculates a velocity banking (HELOC chunking) scenario.
   * Uses a HELOC to make lump-sum payments against debts, then pays down
   * the HELOC with monthly disposable income before repeating.
   * @param req - The scoped request with body containing debts and HELOC params
   * @returns Velocity banking result with schedules and savings vs. baseline
   */
  @Post('velocity-banking')
  velocityBanking(@Req() req: ScopedRequest) {
    const result = VelocityBankingSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.velocityBanking(result.data);
  }

  /**
   * Calculates the minimum-only payoff baseline (no extra payments).
   * Useful for comparing how much other strategies save.
   * @param req - The scoped request with body containing debts
   * @returns Payoff schedule using only minimum payments
   */
  @Post('minimum-only')
  minimumOnly(@Req() req: ScopedRequest) {
    const result = MinimumOnlySchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.debtService.minimumOnly(result.data);
  }
}
