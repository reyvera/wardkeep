import { Controller, Get, Post, Delete, Body, Param, UseGuards, UseInterceptors, Req } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { UserScopeInterceptor, ScopedRequest } from '../common/interceptors/user-scope.interceptor';
import { BankConnectionsService } from './bank-connections.service';
import { CreateBankConnectionDto } from './dto/create-connection.dto';
import { LinkAccountDto } from './dto/link-account.dto';

/**
 * Controller for managing bank connections (SimpleFIN/Plaid).
 * All endpoints require authentication.
 */
@Controller('bank-connections')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class BankConnectionsController {
  constructor(private readonly service: BankConnectionsService) {}

  /**
   * Lists all bank connections for the authenticated user.
   * @returns Array of connections with linked accounts
   */
  @Get()
  async list(@Req() req: ScopedRequest) {
    return this.service.listConnections(req.userId!);
  }

  /**
   * Creates a new bank connection using a setup token from the provider.
   * @param dto - Provider type, institution name, and setup token
   * @returns The created connection with discovered accounts
   */
  @Post()
  async create(@Req() req: ScopedRequest, @Body() dto: CreateBankConnectionDto) {
    return this.service.createConnection(req.userId!, dto);
  }

  /**
   * Links a discovered external account to a local account.
   * @param dto - The linked bank account ID and local account ID
   */
  @Post('link-account')
  async linkAccount(@Req() req: ScopedRequest, @Body() dto: LinkAccountDto) {
    return this.service.linkAccount(req.userId!, dto.linkedBankAccountId, dto.accountId ?? '');
  }

  /**
   * Triggers a manual sync for a specific connection.
   * @param id - The connection ID to sync
   * @returns Sync results with imported/skipped counts
   */
  @Post(':id/sync')
  async sync(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.syncConnection(req.userId!, id);
  }

  /**
   * Removes a bank connection. Does not delete local accounts or transactions.
   * @param id - The connection ID to remove
   */
  @Delete(':id')
  async remove(@Req() req: ScopedRequest, @Param('id') id: string) {
    return this.service.removeConnection(req.userId!, id);
  }
}
