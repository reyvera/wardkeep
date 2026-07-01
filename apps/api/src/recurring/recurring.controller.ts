import {
  BadRequestException,
  Controller,
  Get,
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
import { RecurringService } from './recurring.service';
import { RecurringActionSchema } from './dto/recurring-action.dto';

@Controller('recurring')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  /**
   * Lists confirmed and active recurring transactions for the authenticated user.
   * @param req - The scoped request with userId
   * @returns Array of confirmed recurring transactions
   */
  @Get()
  async listConfirmed(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.recurringService.listConfirmed(userId);
  }

  /**
   * Lists detected (unconfirmed) recurring patterns for the authenticated user.
   * @param req - The scoped request with userId
   * @returns Array of unconfirmed recurring transactions
   */
  @Get('detected')
  async listDetected(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.recurringService.listDetected(userId);
  }

  /**
   * Confirms a detected recurring transaction pattern.
   * @param req - The scoped request with userId and body containing { id }
   * @returns The confirmed recurring transaction
   */
  @Post('confirm')
  async confirm(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = RecurringActionSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.recurringService.confirm(userId, result.data.id);
  }

  /**
   * Dismisses a detected recurring transaction pattern.
   * @param req - The scoped request with userId and body containing { id }
   * @returns The dismissed recurring transaction
   */
  @Post('dismiss')
  async dismiss(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = RecurringActionSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.recurringService.dismiss(userId, result.data.id);
  }

  /**
   * Deactivates (stops monitoring) a recurring transaction.
   * @param req - The scoped request with userId and body containing { id }
   * @returns The deactivated recurring transaction
   */
  @Post('deactivate')
  async deactivate(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = RecurringActionSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.recurringService.deactivate(userId, result.data.id);
  }
}
