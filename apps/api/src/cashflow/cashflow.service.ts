import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  calculateBalance,
  projectCashFlow,
  CashFlowAccount,
  OneTimeEvent,
} from '@wardkeep/finance-engine';
import {
  RecurringTransaction,
  RecurrenceFrequency,
  Transaction,
  TransactionType,
} from '@wardkeep/shared';

import { PrismaService } from '../prisma/prisma.service';
import { OneTimeEventDto } from './dto/one-time-event.dto';

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

    // Future events are household records, not process-local state, so a restart
    // never changes a forecast merely by losing an entered bill or deposit.
    const oneTimeEventRecords = await this.prisma.cashflowEvent.findMany({
      where: { userId, accountId },
      orderBy: { date: 'asc' },
    });
    const oneTimeEvents: OneTimeEvent[] = oneTimeEventRecords.map((event) => ({
      date: event.date,
      amount: event.amount.toFixed(2),
      type: event.type === 'CREDIT' ? 'credit' : 'debit',
      description: event.description,
    }));

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
   * Persists a one-time event for future forecasts.
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

    const event = await this.prisma.cashflowEvent.create({
      data: {
        userId,
        accountId: dto.accountId,
        date: new Date(dto.date),
        amount: new Decimal(dto.amount),
        type: dto.type === 'credit' ? 'CREDIT' : 'DEBIT',
        description: dto.description,
      },
    });

    return {
      id: event.id,
      accountId: event.accountId,
      date: event.date.toISOString(),
      amount: event.amount.toFixed(2),
      type: event.type.toLowerCase(),
      description: event.description,
    };
  }

  /** Lists future one-time cash-flow events for one household account. */
  async listOneTimeEvents(userId: string, accountId: string) {
    const events = await this.prisma.cashflowEvent.findMany({
      where: { userId, accountId },
      orderBy: { date: 'asc' },
    });
    return events.map((event) => ({
      id: event.id,
      accountId: event.accountId,
      date: event.date.toISOString(),
      amount: event.amount.toFixed(2),
      type: event.type.toLowerCase(),
      description: event.description,
    }));
  }

  /** Removes a household-owned future event from its forecast. */
  async removeOneTimeEvent(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.cashflowEvent.findFirst({
      where: { id: eventId, userId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Cash-flow event not found');
    await this.prisma.cashflowEvent.delete({ where: { id: eventId } });
  }
}
