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
import { AccountsService } from './accounts.service';
import { CreateAccountSchema } from './dto/create-account.dto';
import { UpdateAccountSchema } from './dto/update-account.dto';

@Controller('accounts')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Lists active accounts for the authenticated user.
   * Pass ?includeArchived=true to also return archived accounts.
   * @param req - The scoped request with userId
   * @param includeArchived - Query param to include archived accounts
   * @returns Array of accounts with computed current balances
   */
  @Get()
  async listAccounts(
    @Req() req: ScopedRequest,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const userId = req.userId!;
    const showArchived = includeArchived === 'true';
    return this.accountsService.listAccounts(userId, showArchived);
  }

  /**
   * Computes the net worth for the authenticated user.
   * @param req - The scoped request with userId
   * @returns Object with assets, liabilities, and netWorth
   */
  @Get('net-worth')
  async getNetWorth(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.accountsService.getNetWorth(userId);
  }

  /**
   * Creates a new account for the authenticated user.
   * @param req - The scoped request with userId and body
   * @returns The newly created account
   */
  @Post()
  async createAccount(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateAccountSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.accountsService.createAccount(userId, result.data);
  }

  /**
   * Updates an existing account for the authenticated user.
   * @param req - The scoped request with userId and body
   * @param id - The account ID from route params
   * @returns The updated account
   */
  @Patch(':id')
  async updateAccount(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    const result = UpdateAccountSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.accountsService.updateAccount(userId, id, result.data);
  }

  /**
   * Archives (soft deletes) an account for the authenticated user.
   * @param req - The scoped request with userId
   * @param id - The account ID from route params
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveAccount(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    await this.accountsService.archiveAccount(userId, id);
  }
}
