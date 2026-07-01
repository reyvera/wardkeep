import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  calculateBalance,
  projectCashFlow,
  CashFlowAccount,
  OneTimeEvent,
} from '@budgetapp/finance-engine';
import {
  RecurringTransaction,
  RecurrenceFrequency,
  Transaction,
  TransactionType,
} from '@budgetapp/shared';

import { PrismaService } from '../prisma/prisma.service';
import { OneTimeEventDto } from './dto/one-time-event.dto';

/** In-memory store for one-time events (per account). */
const oneTimeEventsStore: Map<string, OneTimeEvent[]> = new Map();

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a 90-day cash-flow forecast for a specific account.
   * Computes current balance, expands confirmed recurring transactions,
   * and projects daily balances forward using the finance engine.
   * @param userId - The authenticated user's ID
   * @param accountId - The account ID to forecast
   * @returns Serialized daily projections and below-zero notifications
   * @throws NotFoundException if account does not exist or belongs to another user
   */
  async getForecast(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        transactions: true,
        linkedBankAccounts: { select: { id: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // For bank-linked accounts, use the reported balance directly
    // For manual accounts, compute from initial + transactions
    let currentBalance: Decimal;
    if (account.linkedBankAccounts.length > 0) {
      currentBalance = new Decimal(account.initialBalance.toString());
    } else {
      currentBalance = calculateBalance(
        new Decimal(account.initialBalance.toString()),
        account.transactions.map((tx) => ({
          ...tx,
          amount: tx.amount.toString(),
          type: tx.type as unknown as TransactionType,
          aiConfidence: tx.aiConfidence?.toString() ?? null,
        })) as Transaction[],
      );
    }

    const cashFlowAccount: CashFlowAccount = {
      id: account.id,
      name: account.name,
      currentBalance: currentBalance.toFixed(2),
    };

    // Get confirmed, active recurring transactions for this account
    const recurringRecords = await this.prisma.recurringTransaction.findMany({
      where: { userId, accountId, isConfirmed: true, isActive: true },
    });

    const recurring: RecurringTransaction[] = recurringRecords.map((r) => ({
      id: r.id,
      userId: r.userId,
      accountId: r.accountId,
      merchant: r.merchant,
      expectedAmount: r.expectedAmount.toString(),
      frequency: r.frequency as unknown as RecurrenceFrequency,
      nextExpected: r.nextExpected,
      isConfirmed: r.isConfirmed,
      isDismissed: r.isDismissed,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));

    // Get stored one-time events for this account
    const oneTimeEvents = oneTimeEventsStore.get(accountId) ?? [];

    // Project cash flow using finance engine
    const result = projectCashFlow(cashFlowAccount, recurring, oneTimeEvents);

    // Serialize Decimal values to strings
    const projections = result.projections.map((p) => ({
      date: p.date.toISOString(),
      credits: p.credits.toFixed(2),
      debits: p.debits.toFixed(2),
      balance: p.balance.toFixed(2),
    }));

    const belowZeroNotifications = result.belowZeroNotifications.map((n) => ({
      accountId: n.accountId,
      accountName: n.accountName,
      date: n.date.toISOString(),
      projectedAmount: n.projectedAmount.toFixed(2),
    }));

    return { projections, belowZeroNotifications };
  }

  /**
   * Adds a one-time event to the in-memory store for future forecasts.
   * @param userId - The authenticated user's ID
   * @param dto - The one-time event data
   * @returns The stored one-time event
   * @throws NotFoundException if the account does not exist or belongs to another user
   */
  async addOneTimeEvent(userId: string, dto: OneTimeEventDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const event: OneTimeEvent = {
      date: new Date(dto.date),
      amount: dto.amount,
      type: dto.type,
      description: dto.description,
    };

    const existing = oneTimeEventsStore.get(dto.accountId) ?? [];
    existing.push(event);
    oneTimeEventsStore.set(dto.accountId, existing);

    return {
      accountId: dto.accountId,
      date: event.date.toISOString(),
      amount: dto.amount,
      type: dto.type,
      description: dto.description,
    };
  }
}
