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
import { TransactionsService, TransactionFilters } from './transactions.service';
import { CreateTransactionSchema } from './dto/create-transaction.dto';
import { UpdateTransactionSchema } from './dto/update-transaction.dto';

const DEFAULT_PAGE_SIZE = 50;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;
const SEARCH_MAX_LENGTH = 200;

@Controller('transactions')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Returns groups of potential duplicate transactions.
   * Duplicates are identified by matching date + amount + merchant (case-insensitive)
   * within the same account.
   * @param req - The scoped request with userId
   * @returns Groups of potential duplicate transactions
   */
  @Get('duplicates')
  async findDuplicates(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.transactionsService.findDuplicates(userId);
  }

  /**
   * Lists transactions for the authenticated user with pagination and filters.
   * Supports filtering by account, category, tag, merchant, date range,
   * amount range, and free-text search.
   * @param req - The scoped request with userId
   * @param page - Page number (default 1)
   * @param pageSize - Items per page (10-200, default 50)
   * @param accountId - Filter by account ID
   * @param categoryId - Filter by category ID
   * @param tag - Filter by tag
   * @param merchant - Filter by merchant (contains)
   * @param dateFrom - Filter by start date (ISO string)
   * @param dateTo - Filter by end date (ISO string)
   * @param amountMin - Filter by minimum amount
   * @param amountMax - Filter by maximum amount
   * @param search - Free-text search across merchant and description
   * @returns Paginated transaction list with metadata
   */
  @Get()
  async listTransactions(
    @Req() req: ScopedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('tag') tag?: string,
    @Query('merchant') merchant?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
    @Query('search') search?: string,
  ) {
    const userId = req.userId!;

    const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const parsedPageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(MIN_PAGE_SIZE, parseInt(pageSize || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    if (search && search.length > SEARCH_MAX_LENGTH) {
      throw new BadRequestException(
        `Search query must be at most ${SEARCH_MAX_LENGTH} characters`,
      );
    }

    const filters: TransactionFilters = {
      page: parsedPage,
      pageSize: parsedPageSize,
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(tag && { tag }),
      ...(merchant && { merchant }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(amountMin && { amountMin }),
      ...(amountMax && { amountMax }),
      ...(search && { search }),
    };

    return this.transactionsService.listTransactions(userId, filters);
  }

  /**
   * Creates a new transaction for the authenticated user.
   * @param req - The scoped request with userId and body
   * @returns The newly created transaction
   */
  @Post()
  async createTransaction(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateTransactionSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.transactionsService.createTransaction(userId, result.data);
  }

  /**
   * Updates an existing transaction for the authenticated user.
   * @param req - The scoped request with userId and body
   * @param id - The transaction ID from route params
   * @returns The updated transaction
   */
  @Patch(':id')
  async updateTransaction(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    const result = UpdateTransactionSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.transactionsService.updateTransaction(userId, id, result.data);
  }

  /**
   * Deletes a transaction for the authenticated user (hard delete).
   * @param req - The scoped request with userId
   * @param id - The transaction ID from route params
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTransaction(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    await this.transactionsService.deleteTransaction(userId, id);
  }
}
