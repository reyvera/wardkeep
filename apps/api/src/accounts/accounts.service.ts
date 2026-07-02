import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  AccountType,
  MAX_ACCOUNTS_PER_USER,
} from '@wardkeep/shared';
import {
  calculateBalance,
  calculateNetWorth,
  AccountWithTransactions,
} from '@wardkeep/finance-engine';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists accounts for a user, optionally including archived accounts.
   * Computes current balance for each account from initial balance + transactions.
   * @param userId - The authenticated user's ID
   * @param includeArchived - Whether to include archived accounts in the result
   * @returns Array of accounts with computed current balances
   */
  async listAccounts(userId: string, includeArchived: boolean) {
    const where: { userId: string; isArchived?: boolean } = { userId };
    if (!includeArchived) {
      where.isArchived = false;
    }

    const accounts = await this.prisma.account.findMany({
      where,
      include: {
        transactions: true,
        linkedBankAccounts: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map((account) => {
      let currentBalance: string;

      // For bank-linked accounts, use the bank-reported balance (stored in initialBalance)
      // For manual accounts, compute from initial balance + transactions
      if (account.linkedBankAccounts.length > 0) {
        currentBalance = new Decimal(account.initialBalance.toString()).toFixed(2);
      } else {
        const computed = calculateBalance(
          new Decimal(account.initialBalance.toString()),
          account.transactions.map((tx) => ({
            ...tx,
            amount: tx.amount.toString(),
            aiConfidence: tx.aiConfidence?.toString() ?? null,
          })),
        );
        currentBalance = computed.toFixed(2);
      }

      return {
        id: account.id,
        userId: account.userId,
        name: account.name,
        type: account.type,
        currency: account.currency,
        initialBalance: account.initialBalance.toString(),
        currentBalance,
        isArchived: account.isArchived,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });
  }

  /**
   * Creates a new account for the user.
   * Enforces unique name per user and maximum account limit.
   * @param userId - The authenticated user's ID
   * @param dto - The account creation data
   * @returns The newly created account
   * @throws ConflictException if account name already exists for user
   * @throws BadRequestException if user has reached the maximum account limit
   */
  async createAccount(userId: string, dto: CreateAccountDto) {
    const accountCount = await this.prisma.account.count({ where: { userId } });
    if (accountCount >= MAX_ACCOUNTS_PER_USER) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACCOUNTS_PER_USER} accounts allowed per user`,
      );
    }

    const existing = await this.prisma.account.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('An account with this name already exists');
    }

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency ?? 'USD',
        initialBalance: new Decimal(dto.initialBalance),
      },
    });

    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance.toString(),
      currentBalance: new Decimal(account.initialBalance.toString()).toFixed(2),
      isArchived: account.isArchived,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Updates an existing account for the user.
   * Enforces unique name constraint if name is being changed.
   * @param userId - The authenticated user's ID
   * @param accountId - The account ID to update
   * @param dto - The fields to update
   * @returns The updated account
   * @throws NotFoundException if account does not exist or belongs to another user
   * @throws ConflictException if the new name conflicts with an existing account
   */
  async updateAccount(userId: string, accountId: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (dto.name && dto.name !== account.name) {
      const existing = await this.prisma.account.findUnique({
        where: { userId_name: { userId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException('An account with this name already exists');
      }
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.initialBalance !== undefined && {
          initialBalance: new Decimal(dto.initialBalance),
        }),
      },
      include: {
        transactions: true,
        linkedBankAccounts: { select: { id: true } },
      },
    });

    let currentBalance: string;
    if (updated.linkedBankAccounts.length > 0) {
      currentBalance = new Decimal(updated.initialBalance.toString()).toFixed(2);
    } else {
      const computed = calculateBalance(
        new Decimal(updated.initialBalance.toString()),
        updated.transactions.map((tx) => ({
          ...tx,
          amount: tx.amount.toString(),
          aiConfidence: tx.aiConfidence?.toString() ?? null,
        })),
      );
      currentBalance = computed.toFixed(2);
    }

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      type: updated.type,
      currency: updated.currency,
      initialBalance: updated.initialBalance.toString(),
      currentBalance,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Archives (soft deletes) an account.
   * @param userId - The authenticated user's ID
   * @param accountId - The account ID to archive
   * @throws NotFoundException if account does not exist or belongs to another user
   */
  async archiveAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { isArchived: true },
    });
  }

  /**
   * Permanently deletes an account, its transactions, and unlinks any bank connections.
   * @param userId - The authenticated user's ID
   * @param accountId - The account ID to delete
   * @throws NotFoundException if account does not exist or belongs to another user
   */
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Unlink any bank connections pointing to this account
    await this.prisma.linkedBankAccount.updateMany({
      where: { accountId },
      data: { accountId: null },
    });

    // Delete all transactions for this account
    await this.prisma.transaction.deleteMany({
      where: { accountId },
    });

    // Delete recurring transactions for this account
    await this.prisma.recurringTransaction.deleteMany({
      where: { accountId },
    });

    // Delete the account itself
    await this.prisma.account.delete({
      where: { id: accountId },
    });
  }

  /**
   * Computes the user's net worth from all active (non-archived) accounts.
   * For bank-linked accounts, uses the bank-reported balance directly.
   * For manual accounts, computes from initial balance + transactions.
   * Net worth = total assets - total liabilities.
   * @param userId - The authenticated user's ID
   * @returns Object with assets, liabilities, and netWorth as formatted decimal strings
   */
  async getNetWorth(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      include: {
        transactions: true,
        linkedBankAccounts: { select: { id: true } },
      },
    });

    let assets = new Decimal(0);
    let liabilities = new Decimal(0);

    const liabilityTypes = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC'];

    for (const account of accounts) {
      let balance: Decimal;

      if (account.linkedBankAccounts.length > 0) {
        // Bank-linked: use reported balance
        balance = new Decimal(account.initialBalance.toString());
      } else {
        // Manual: compute from transactions
        balance = calculateBalance(
          new Decimal(account.initialBalance.toString()),
          account.transactions.map((tx) => ({
            ...tx,
            amount: tx.amount.toString(),
            aiConfidence: tx.aiConfidence?.toString() ?? null,
          })),
        );
      }

      if (liabilityTypes.includes(account.type)) {
        liabilities = liabilities.plus(balance.abs());
      } else {
        assets = assets.plus(balance);
      }
    }

    const netWorth = assets.minus(liabilities);

    return {
      assets: assets.toFixed(2),
      liabilities: liabilities.toFixed(2),
      netWorth: netWorth.toFixed(2),
    };
  }
}
