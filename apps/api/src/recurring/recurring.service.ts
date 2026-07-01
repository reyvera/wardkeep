import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

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
}
