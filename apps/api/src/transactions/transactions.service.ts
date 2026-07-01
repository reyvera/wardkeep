import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

/** Filter options for listing transactions. */
export interface TransactionFilters {
  page: number;
  pageSize: number;
  accountId?: string;
  categoryId?: string;
  tag?: string;
  merchant?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  search?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly rulesService: RulesService,
  ) {}

  /**
   * Lists transactions for a user with pagination and filtering.
   * Supports filtering by account, category, tag, merchant, date range,
   * amount range, and free-text search across merchant and description.
   * @param userId - The authenticated user's ID
   * @param filters - Pagination and filter parameters
   * @returns Paginated transaction list with metadata
   */
  async listTransactions(userId: string, filters: TransactionFilters) {
    const { page, pageSize } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = { userId };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.merchant) {
      where.merchant = { contains: filters.merchant, mode: 'insensitive' };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.date.lte = new Date(filters.dateTo);
      }
    }

    if (filters.amountMin || filters.amountMax) {
      where.amount = {};
      if (filters.amountMin) {
        where.amount.gte = new Decimal(filters.amountMin);
      }
      if (filters.amountMax) {
        where.amount.lte = new Decimal(filters.amountMax);
      }
    }

    if (filters.tag) {
      where.tags = { some: { tag: filters.tag } };
    }

    if (filters.search) {
      where.OR = [
        { merchant: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [totalItems, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { tags: true },
        orderBy: { date: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        accountId: tx.accountId,
        categoryId: tx.categoryId,
        date: tx.date,
        amount: tx.amount.toString(),
        type: tx.type,
        merchant: tx.merchant,
        description: tx.description,
        notes: tx.notes,
        isReconciliation: tx.isReconciliation,
        aiCategorized: tx.aiCategorized,
        aiConfidence: tx.aiConfidence?.toString() ?? null,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        tags: tx.tags.map((t) => ({ id: t.id, transactionId: t.transactionId, tag: t.tag })),
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Creates a new transaction for the user.
   * Verifies the target account belongs to the user before creating.
   * If tags are provided, creates associated TransactionTag records.
   * @param userId - The authenticated user's ID
   * @param dto - The transaction creation data
   * @returns The newly created transaction with tags
   * @throws NotFoundException if the account does not belong to the user
   */
  async createTransaction(userId: string, dto: CreateTransactionDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        date: new Date(dto.date),
        amount: new Decimal(dto.amount),
        type: dto.type,
        categoryId: dto.categoryId ?? null,
        merchant: dto.merchant ?? null,
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        ...(dto.tags && dto.tags.length > 0
          ? {
              tags: {
                create: dto.tags.map((tag) => ({ tag })),
              },
            }
          : {}),
      },
      include: { tags: true },
    });

    await this.checkBudgetThreshold(userId, {
      categoryId: transaction.categoryId,
      date: transaction.date,
      type: transaction.type,
    });

    // Apply matching rules to auto-categorize/tag the new transaction
    const appliedActions = await this.rulesService.applyRulesToTransaction(userId, {
      id: transaction.id,
      merchant: transaction.merchant,
      amount: transaction.amount.toString(),
      description: transaction.description,
      tags: transaction.tags.map((t) => t.tag),
    });

    // Reload if rules modified the transaction
    if (appliedActions) {
      const updated = await this.prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { tags: true },
      });
      if (updated) {
        return {
          id: updated.id,
          userId: updated.userId,
          accountId: updated.accountId,
          categoryId: updated.categoryId,
          date: updated.date,
          amount: updated.amount.toString(),
          type: updated.type,
          merchant: updated.merchant,
          description: updated.description,
          notes: updated.notes,
          isReconciliation: updated.isReconciliation,
          aiCategorized: updated.aiCategorized,
          aiConfidence: updated.aiConfidence?.toString() ?? null,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          tags: updated.tags.map((t) => ({
            id: t.id,
            transactionId: t.transactionId,
            tag: t.tag,
          })),
        };
      }
    }

    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      date: transaction.date,
      amount: transaction.amount.toString(),
      type: transaction.type,
      merchant: transaction.merchant,
      description: transaction.description,
      notes: transaction.notes,
      isReconciliation: transaction.isReconciliation,
      aiCategorized: transaction.aiCategorized,
      aiConfidence: transaction.aiConfidence?.toString() ?? null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      tags: transaction.tags.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        tag: t.tag,
      })),
    };
  }

  /**
   * Updates an existing transaction for the user.
   * Verifies the transaction belongs to the user. If accountId is being changed,
   * verifies the new account also belongs to the user.
   * Tags are replaced: existing tags are deleted and new ones created.
   * @param userId - The authenticated user's ID
   * @param transactionId - The transaction ID to update
   * @param dto - The fields to update
   * @returns The updated transaction with tags
   * @throws NotFoundException if the transaction or new account is not found
   */
  async updateTransaction(userId: string, transactionId: string, dto: UpdateTransactionDto) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, userId },
      });
      if (!account) {
        throw new NotFoundException('Account not found');
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      if (dto.tags !== undefined) {
        await tx.transactionTag.deleteMany({ where: { transactionId } });
      }

      return tx.transaction.update({
        where: { id: transactionId },
        data: {
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(dto.date !== undefined && { date: new Date(dto.date) }),
          ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId ?? null }),
          ...(dto.merchant !== undefined && { merchant: dto.merchant ?? null }),
          ...(dto.description !== undefined && { description: dto.description ?? null }),
          ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
          ...(dto.tags !== undefined && dto.tags.length > 0
            ? {
                tags: {
                  create: dto.tags.map((tag) => ({ tag })),
                },
              }
            : {}),
        },
        include: { tags: true },
      });
    });

    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      date: transaction.date,
      amount: transaction.amount.toString(),
      type: transaction.type,
      merchant: transaction.merchant,
      description: transaction.description,
      notes: transaction.notes,
      isReconciliation: transaction.isReconciliation,
      aiCategorized: transaction.aiCategorized,
      aiConfidence: transaction.aiConfidence?.toString() ?? null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      tags: transaction.tags.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        tag: t.tag,
      })),
    };
  }

  /**
   * Detects potential duplicate transactions for a user.
   * Duplicates are identified by matching date + amount + merchant (case-insensitive, trimmed)
   * within the same account. Only considers transactions where merchant is not null.
   * @param userId - The authenticated user's ID
   * @returns Groups of potential duplicate transactions
   */
  async findDuplicates(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, merchant: { not: null } },
      orderBy: { date: 'desc' },
    });

    const groups = new Map<string, typeof transactions>();

    for (const tx of transactions) {
      const dateStr = tx.date.toISOString().split('T')[0];
      const merchantKey = tx.merchant!.trim().toLowerCase();
      const key = `${tx.accountId}|${dateStr}|${tx.amount.toString()}|${merchantKey}`;

      const group = groups.get(key) ?? [];
      group.push(tx);
      groups.set(key, group);
    }

    const duplicateGroups = Array.from(groups.values())
      .filter((group) => group.length > 1)
      .map((group) => ({
        key: {
          accountId: group[0].accountId,
          date: group[0].date,
          amount: group[0].amount.toString(),
          merchant: group[0].merchant,
        },
        transactions: group.map((tx) => ({
          id: tx.id,
          accountId: tx.accountId,
          date: tx.date,
          amount: tx.amount.toString(),
          type: tx.type,
          merchant: tx.merchant,
          description: tx.description,
          categoryId: tx.categoryId,
          createdAt: tx.createdAt,
        })),
      }));

    return duplicateGroups;
  }

  /**
   * Deletes a transaction belonging to the user.
   * Cascade delete removes associated tags automatically.
   * @param userId - The authenticated user's ID
   * @param transactionId - The transaction ID to delete
   * @throws NotFoundException if the transaction does not belong to the user
   */
  async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.transaction.delete({ where: { id: transactionId } });
  }

  /**
   * Checks if a transaction pushes a category's spending past budget thresholds.
   * Emits a notification at 90% (warning) and 100% (overspent) of allocation.
   * @param userId - The authenticated user's ID
   * @param transaction - The transaction details to check against budget
   */
  private async checkBudgetThreshold(
    userId: string,
    transaction: { categoryId: string | null; date: Date; type: string },
  ): Promise<void> {
    if (!transaction.categoryId || transaction.type !== 'DEBIT') return;

    const txDate = transaction.date;
    const startOfMonth = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), 1));
    const startOfNext = new Date(
      Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth() + 1, 1),
    );

    // Find budget allocation for this category in this month
    const allocation = await this.prisma.budgetAllocation.findFirst({
      where: {
        categoryId: transaction.categoryId,
        budget: { userId, month: startOfMonth },
      },
    });

    if (!allocation) return;

    // Sum spending for this category in this month
    const spending = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: transaction.categoryId,
        type: 'DEBIT',
        date: { gte: startOfMonth, lt: startOfNext },
      },
      _sum: { amount: true },
    });

    const spent = spending._sum.amount ?? 0;
    const allocated = allocation.amount;
    const ratio = Number(spent) / Number(allocated);

    if (ratio >= 1.0) {
      this.notificationsService.emitBudgetNotification({
        userId,
        type: 'budget_overspent',
        categoryId: transaction.categoryId,
        percentUsed: (ratio * 100).toFixed(2),
        allocated: allocated.toString(),
        spent: spent.toString(),
        createdAt: new Date(),
      });
    } else if (ratio >= 0.9) {
      this.notificationsService.emitBudgetNotification({
        userId,
        type: 'budget_warning',
        categoryId: transaction.categoryId,
        percentUsed: (ratio * 100).toFixed(2),
        allocated: allocated.toString(),
        spent: spent.toString(),
        createdAt: new Date(),
      });
    }
  }

  /**
   * Returns spending statistics for the dashboard:
   * - Monthly income vs expenses for the last 6 months
   * - Spending by category for the current month
   * - Top merchants for the current month
   */
  async getSpendingStats(userId: string) {
    const now = new Date();

    // Last 6 months of income vs expenses
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const [income, expenses] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { userId, type: 'CREDIT', date: { gte: date, lt: nextMonth } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { userId, type: 'DEBIT', date: { gte: date, lt: nextMonth } },
          _sum: { amount: true },
        }),
      ]);

      monthlyTrend.push({
        month: label,
        income: Number(income._sum.amount ?? 0),
        expenses: Number(expenses._sum.amount ?? 0),
      });
    }

    // Current month spending by category
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const categorySpending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'DEBIT',
        date: { gte: startOfMonth, lt: startOfNext },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    // Resolve category names
    const categoryIds = categorySpending
      .map((c) => c.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const spendingByCategory = categorySpending.map((c) => ({
      categoryId: c.categoryId,
      name: catMap.get(c.categoryId ?? '') ?? 'Uncategorized',
      amount: Number(c._sum.amount ?? 0),
    }));

    // Top merchants this month
    const topMerchants = await this.prisma.transaction.groupBy({
      by: ['merchant'],
      where: {
        userId,
        type: 'DEBIT',
        date: { gte: startOfMonth, lt: startOfNext },
        merchant: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    });

    return {
      monthlyTrend,
      spendingByCategory,
      topMerchants: topMerchants.map((m) => ({
        merchant: m.merchant ?? 'Unknown',
        amount: Number(m._sum.amount ?? 0),
      })),
    };
  }
}
