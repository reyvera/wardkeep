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
import { RulesService } from './rules.service';
import { CreateRuleSchema, UpdateRuleSchema } from './dto/create-rule.dto';

@Controller('rules')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  /**
   * Lists all rules for the authenticated user, sorted by priority ascending.
   * @param req - The scoped request with userId
   * @returns Array of rules with conditions and actions
   */
  @Get()
  async listRules(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.rulesService.listRules(userId);
  }

  /**
   * Creates a new rule for the authenticated user.
   * @param req - The scoped request with userId and body
   * @returns The newly created rule
   */
  @Post()
  async createRule(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateRuleSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.rulesService.createRule(userId, result.data);
  }

  /**
   * Updates an existing rule for the authenticated user.
   * @param req - The scoped request with userId and body
   * @param id - The rule ID from route params
   * @returns The updated rule
   */
  @Patch(':id')
  async updateRule(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    const result = UpdateRuleSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.rulesService.updateRule(userId, id, result.data);
  }

  /**
   * Deletes a rule for the authenticated user.
   * @param req - The scoped request with userId
   * @param id - The rule ID from route params
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    await this.rulesService.deleteRule(userId, id);
  }

  /**
   * Dry-runs a rule against all user transactions without modifying data.
   * @param req - The scoped request with userId
   * @param id - The rule ID from route params
   * @returns Array of matching transactions
   */
  @Post(':id/dry-run')
  async dryRun(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    return this.rulesService.dryRun(userId, id);
  }

  /**
   * Applies a rule retroactively to all matching transactions.
   * @param req - The scoped request with userId
   * @param id - The rule ID from route params
   * @returns Object with the count of affected transactions
   */
  @Post(':id/apply')
  async applyRule(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    return this.rulesService.applyRule(userId, id);
  }
}
