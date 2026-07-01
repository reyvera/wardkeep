import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { TransactionType } from '@budgetapp/shared';
import { calculateBudgetSummary } from '@budgetapp/finance-engine';

import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

/**
 * Parses a "YYYY-MM" string into a Date representing the first day of that month (UTC).
 * @param month - Month string in YYYY-MM format
 * @returns Date object set to the first day of the month
 */
function parseMonth(month: string): Date {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

/**
 * Computes the previous month's date from a "YYYY-MM" string.
 * @param month - Month string in YYYY-MM format
 * @returns Date object set to the first day of the previous month
 */
function getPreviousMonth(month: string): Date {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const date = new Date(Date.UTC(year, monthIndex - 1, 1));
  return date;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the budget for a user in a specific month, including allocations.
   * @param userId - The authenticated user's ID
   * @param month - Month in YYYY-MM format
   * @returns The budget with allocations serialized, or null if not found
   */
  async getBudgetByMonth(userId: string, month: string) {
    const monthDate = parseMonth(month);

    const budget = await this.prisma.budget.findUnique({
      where: { userId_month: { userId, month: monthDate } },
      include: { allocations: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found for this month');
    }

    return {
      id: budget.id,
      userId: budget.userId,
      month: budget.month,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      allocations: budget.allocations.map((a) => ({
        id: a.id,
        budgetId: a.budgetId,
        categoryId: a.categoryId,
        amount: new Decimal(a.amount.toString()).toFixed(2),
      })),
    };
  }

  /**
   * Creates a new budget for the user for a specific month with allocations.
   * Enforces one budget per user per month.
   * @param userId - The authenticated user's ID
   * @param dto - The budget creation data with month and allocations
   * @returns The newly created budget with allocations
   * @throws ConflictException if a budget already exists for this user and month
   */
  async createBudget(userId: string, dto: CreateBudgetDto) {
    const monthDate = parseMonth(dto.month);

    const existing = await this.prisma.budget.findUnique({
      where: { userId_month: { userId, month: monthDate } },
    });

    if (existing) {
      throw new ConflictException('A budget already exists for this month');
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        month: monthDate,
        allocations: {
          create: dto.allocations.map((a) => ({
            categoryId: a.categoryId,
            amount: new Decimal(a.amount),
          })),
        },
      },
      include: { allocations: true },
    });

    return {
      id: budget.id,
      userId: budget.userId,
      month: budget.month,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      allocations: budget.allocations.map((a) => ({
        id: a.id,
        budgetId: a.budgetId,
        categoryId: a.categoryId,
        amount: new Decimal(a.amount.toString()).toFixed(2),
      })),
    };
  }

  /**
   * Updates allocations for an existing budget. Replaces all allocations atomically.
   * @param userId - The authenticated user's ID
   * @param budgetId - The budget ID to update
   * @param dto - The new allocations
   * @returns The updated budget with new allocations
   * @throws NotFoundException if the budget does not exist or belongs to another user
   */
  async updateBudget(userId: string, budgetId: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.budgetAllocation.deleteMany({ where: { budgetId } });

      return tx.budget.update({
        where: { id: budgetId },
        data: {
          allocations: {
            create: dto.allocations.map((a) => ({
              categoryId: a.categoryId,
              amount: new Decimal(a.amount),
            })),
          },
        },
        include: { allocations: true },
      });
    });

    return {
      id: updated.id,
      userId: updated.userId,
      month: updated.month,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      allocations: updated.allocations.map((a) => ({
        id: a.id,
        budgetId: a.budgetId,
        categoryId: a.categoryId,
        amount: new Decimal(a.amount.toString()).toFixed(2),
      })),
    };
  }

  /**
   * Copies a budget from the previous month into the given month.
   * Only copies allocations whose categories still exist for the user.
   * @param userId - The authenticated user's ID
   * @param month - Target month in YYYY-MM format (copies from month - 1)
   * @returns The newly created budget with copied allocations
   * @throws NotFoundException if no budget exists for the previous month
   * @throws ConflictException if a budget already exists for the target month
   */
  async copyFromPreviousMonth(userId: string, month: string) {
    const previousMonthDate = getPreviousMonth(month);
    const targetMonthDate = parseMonth(month);

    const existingTarget = await this.prisma.budget.findUnique({
      where: { userId_month: { userId, month: targetMonthDate } },
    });

    if (existingTarget) {
      throw new ConflictException('A budget already exists for this month');
    }

    const previousBudget = await this.prisma.budget.findUnique({
      where: { userId_month: { userId, month: previousMonthDate } },
      include: { allocations: true },
    });

    if (!previousBudget) {
      throw new NotFoundException('No budget found for the previous month');
    }

    // Filter allocations: only copy those whose categoryId still exists for the user
    const userCategories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true },
    });
    const validCategoryIds = new Set(userCategories.map((c) => c.id));

    const filteredAllocations = previousBudget.allocations.filter((a) =>
      validCategoryIds.has(a.categoryId),
    );

    if (filteredAllocations.length === 0) {
      throw new NotFoundException(
        'No valid allocations to copy from previous month',
      );
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        month: targetMonthDate,
        allocations: {
          create: filteredAllocations.map((a) => ({
            categoryId: a.categoryId,
            amount: a.amount,
          })),
        },
      },
      include: { allocations: true },
    });

    return {
      id: budget.id,
      userId: budget.userId,
      month: budget.month,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      allocations: budget.allocations.map((a) => ({
        id: a.id,
        budgetId: a.budgetId,
        categoryId: a.categoryId,
        amount: new Decimal(a.amount.toString()).toFixed(2),
      })),
    };
  }

  /**
   * Computes budget summary for a month using the Finance Engine.
   * Aggregates actual DEBIT spending per category and computes progress.
   * @param userId - The authenticated user's ID
   * @param month - Month in YYYY-MM format
   * @returns Budget summary with totals and per-category progress
   * @throws NotFoundException if no budget exists for the month
   */
  async getBudgetSummary(userId: string, month: string) {
    const monthDate = parseMonth(month);

    const budget = await this.prisma.budget.findUnique({
      where: { userId_month: { userId, month: monthDate } },
      include: { allocations: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found for this month');
    }

    // Get the start and end of the month for transaction query
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const startOfMonth = new Date(Date.UTC(year, monthIndex, 1));
    const startOfNextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.DEBIT,
        date: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    });

    // Map Prisma results to shared types for the finance engine
    const budgetForEngine = {
      id: budget.id,
      userId: budget.userId,
      month: budget.month,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      allocations: budget.allocations.map((a) => ({
        id: a.id,
        budgetId: a.budgetId,
        categoryId: a.categoryId,
        amount: a.amount.toString(),
      })),
    };

    const transactionsForEngine = transactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      date: tx.date,
      amount: tx.amount.toString(),
      type: tx.type as TransactionType,
      merchant: tx.merchant,
      description: tx.description,
      notes: tx.notes,
      isReconciliation: tx.isReconciliation,
      aiCategorized: tx.aiCategorized,
      aiConfidence: tx.aiConfidence?.toString() ?? null,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }));

    const summary = calculateBudgetSummary(budgetForEngine, transactionsForEngine);

    return {
      totalAllocated: summary.totalAllocated.toFixed(2),
      totalSpent: summary.totalSpent.toFixed(2),
      totalRemaining: summary.totalRemaining.toFixed(2),
      overspentCount: summary.overspentCount,
      categoryProgress: summary.categoryProgress.map((cp) => ({
        categoryId: cp.categoryId,
        allocated: cp.allocated.toFixed(2),
        spent: cp.spent.toFixed(2),
        remaining: cp.remaining.toFixed(2),
        percentUsed: cp.percentUsed.toFixed(2),
        status: cp.status,
      })),
    };
  }
}
