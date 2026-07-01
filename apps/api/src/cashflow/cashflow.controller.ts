import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { CashflowService } from './cashflow.service';
import { OneTimeEventSchema } from './dto/one-time-event.dto';

@Controller('cashflow')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  /**
   * Returns a 90-day cash-flow forecast for the specified account.
   * @param req - The scoped request with userId
   * @param accountId - The account ID query parameter
   * @returns Daily projections and below-zero notifications
   */
  @Get('forecast')
  async getForecast(
    @Req() req: ScopedRequest,
    @Query('accountId') accountId?: string,
  ) {
    const userId = req.userId!;

    if (!accountId) {
      throw new BadRequestException('accountId query parameter is required');
    }

    return this.cashflowService.getForecast(userId, accountId);
  }

  /**
   * Adds a one-time future event for cash-flow forecasting.
   * @param req - The scoped request with userId and body
   * @returns The stored one-time event
   */
  @Post('one-time')
  async addOneTimeEvent(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = OneTimeEventSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.cashflowService.addOneTimeEvent(userId, result.data);
  }
}
