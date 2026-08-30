import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@wardkeep/shared';

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists confirmed and active recurring transactions for a user.
   * @param userId - The authenticated user's ID
   * @returns Array of confirmed, active recurring transactions
   */
  async listConfirmed(userId: string) {
    const records = await this.prisma.recurringTransaction.findMany({
      where: { userId, isConfirmed: true, isActive: true },
      orderBy: { nextExpected: 'asc' },
    });

    const cancellations = records.filter((record) => record.cancelledAt);
    const charges = cancellations.length === 0 ? [] : await this.prisma.transaction.findMany({ where: { userId, type: TransactionType.DEBIT, OR: cancellations.map((record) => ({ merchant: record.merchant, date: { gt: record.cancelledAt! } })) }, select: { merchant: true, date: true } });
    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      accountId: r.accountId,
      merchant: r.merchant,
      expectedAmount: r.expectedAmount.toString(),
      frequency: r.frequency,
      nextExpected: r.nextExpected,
      isConfirmed: r.isConfirmed,
      isDismissed: r.isDismissed,
      isActive: r.isActive,
      isSubscription: r.isSubscription,
      cancelledAt: r.cancelledAt,
      chargeAfterCancellation: !!r.cancelledAt && charges.some((charge) => charge.merchant === r.merchant && charge.date > r.cancelledAt!),
      createdAt: r.createdAt,
    }));
  }

  /**
   * Lists detected (unconfirmed, not dismissed) recurring patterns for a user.
   * @param userId - The authenticated user's ID
   * @returns Array of unconfirmed, non-dismissed recurring transactions
   */
  async listDetected(userId: string) {
    const records = await this.prisma.recurringTransaction.findMany({
      where: { userId, isConfirmed: false, isDismissed: false },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      accountId: r.accountId,
      merchant: r.merchant,
      expectedAmount: r.expectedAmount.toString(),
      frequency: r.frequency,
      nextExpected: r.nextExpected,
      isConfirmed: r.isConfirmed,
      isDismissed: r.isDismissed,
      isActive: r.isActive,
      isSubscription: r.isSubscription,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Confirms a detected recurring transaction pattern.
   * @param userId - The authenticated user's ID
   * @param id - The recurring transaction ID to confirm
   * @returns The updated recurring transaction
   * @throws NotFoundException if the record does not exist or belongs to another user
   */
  async confirm(userId: string, id: string) {
    const record = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!record) {
      throw new NotFoundException('Recurring transaction not found');
    }

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: { isConfirmed: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      merchant: updated.merchant,
      expectedAmount: updated.expectedAmount.toString(),
      frequency: updated.frequency,
      nextExpected: updated.nextExpected,
      isConfirmed: updated.isConfirmed,
      isDismissed: updated.isDismissed,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Dismisses a detected recurring transaction pattern.
   * @param userId - The authenticated user's ID
   * @param id - The recurring transaction ID to dismiss
   * @returns The updated recurring transaction
   * @throws NotFoundException if the record does not exist or belongs to another user
   */
  async dismiss(userId: string, id: string) {
    const record = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!record) {
      throw new NotFoundException('Recurring transaction not found');
    }

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: { isDismissed: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      merchant: updated.merchant,
      expectedAmount: updated.expectedAmount.toString(),
      frequency: updated.frequency,
      nextExpected: updated.nextExpected,
      isConfirmed: updated.isConfirmed,
      isDismissed: updated.isDismissed,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Deactivates (stops monitoring) a recurring transaction.
   * @param userId - The authenticated user's ID
   * @param id - The recurring transaction ID to deactivate
   * @returns The updated recurring transaction
   * @throws NotFoundException if the record does not exist or belongs to another user
   */
  async deactivate(userId: string, id: string) {
    const record = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!record) {
      throw new NotFoundException('Recurring transaction not found');
    }

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      merchant: updated.merchant,
      expectedAmount: updated.expectedAmount.toString(),
      frequency: updated.frequency,
      nextExpected: updated.nextExpected,
      isConfirmed: updated.isConfirmed,
      isDismissed: updated.isDismissed,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async setSubscription(userId: string, id: string, isSubscription: boolean) {
    const record = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Recurring transaction not found');

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: { isSubscription },
    });
    return { id: updated.id, isSubscription: updated.isSubscription };
  }

  async setCancelled(userId: string, id: string, cancelledAt: Date | null) {
    const record = await this.prisma.recurringTransaction.findFirst({ where: { id, userId }, select: { id: true } });
    if (!record) throw new NotFoundException('Recurring transaction not found');
    return this.prisma.recurringTransaction.update({ where: { id }, data: { cancelledAt } });
  }
}
