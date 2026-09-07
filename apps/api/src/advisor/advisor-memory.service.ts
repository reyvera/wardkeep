import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvisorMemoryKind } from '@prisma/client';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdvisorMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns only current household-local entries; expired memory is never surfaced. */
  async list(userId: string, now = new Date()) {
    await this.prisma.advisorMemory.deleteMany({ where: { userId, expiresAt: { lte: now } } });
    await this.syncAnnualRecurringEvents(userId);
    await this.syncMeasuredSeasonalPatterns(userId, now);
    return this.prisma.advisorMemory.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Derives only confirmed annual bill reminders; it does not infer spending patterns. */
  private async syncAnnualRecurringEvents(userId: string) {
    const annualBills = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true, isConfirmed: true, frequency: 'ANNUAL' },
      select: { id: true, merchant: true, nextExpected: true },
    });
    const activeSourceRefs = new Set(annualBills.map((bill) => `recurring:${bill.id}`));
    const priorAutomaticEvents = await this.prisma.advisorMemory.findMany({
      where: { userId, kind: 'ANNUAL_EVENT' },
      select: { id: true, sourceRefs: true },
    });
    const staleIds = priorAutomaticEvents
      .filter((memory) => memory.sourceRefs.some((source) => source.startsWith('recurring:')))
      .filter((memory) => !memory.sourceRefs.some((source) => activeSourceRefs.has(source)))
      .map((memory) => memory.id);
    if (staleIds.length > 0) {
      await this.prisma.advisorMemory.deleteMany({ where: { userId, id: { in: staleIds } } });
    }
    await Promise.all(
      annualBills.map(async (bill) => {
        const sourceRef = `recurring:${bill.id}`;
        const existing = await this.prisma.advisorMemory.findFirst({
          where: { userId, kind: 'ANNUAL_EVENT', sourceRefs: { has: sourceRef } },
          select: { id: true },
        });
        const data = {
          summary: `${bill.merchant} is a confirmed annual recurring bill next expected on ${bill.nextExpected.toLocaleDateString()}.`,
          observedAt: bill.nextExpected,
        };
        if (existing) {
          await this.prisma.advisorMemory.update({ where: { id: existing.id }, data });
        } else {
          await this.prisma.advisorMemory.create({
            data: {
              userId,
              kind: 'ANNUAL_EVENT',
              sourceRefs: [sourceRef],
              ...data,
            },
          });
        }
      }),
    );
  }

  /**
   * Records a seasonal observation only when the same category has entries in
   * both prior calendar years. It is historical context, not a forecast.
   */
  private async syncMeasuredSeasonalPatterns(userId: string, now: Date) {
    const month = now.getUTCMonth();
    const recentYear = now.getUTCFullYear() - 1;
    const olderYear = recentYear - 1;
    const range = (year: number) => ({
      gte: new Date(Date.UTC(year, month, 1)),
      lt: new Date(Date.UTC(year, month + 1, 1)),
    });
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'DEBIT',
        categoryId: { not: null },
        OR: [{ date: range(recentYear) }, { date: range(olderYear) }],
      },
      select: { categoryId: true, amount: true, date: true, category: { select: { name: true } } },
    });
    const totals = new Map<string, { name: string; recent: Decimal; older: Decimal }>();
    for (const transaction of transactions) {
      if (!transaction.categoryId || !transaction.category) continue;
      const current = totals.get(transaction.categoryId) ?? {
        name: transaction.category.name,
        recent: new Decimal(0),
        older: new Decimal(0),
      };
      const amount = new Decimal(transaction.amount);
      if (transaction.date.getUTCFullYear() === recentYear) current.recent = current.recent.plus(amount);
      if (transaction.date.getUTCFullYear() === olderYear) current.older = current.older.plus(amount);
      totals.set(transaction.categoryId, current);
    }
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(now);
    const existing = await this.prisma.advisorMemory.findMany({
      where: { userId, kind: 'SEASONAL_PATTERN' },
      select: { id: true, sourceRefs: true },
    });
    const existingBySource = new Map(
      existing.flatMap((memory) =>
        memory.sourceRefs
          .filter((source) => source.startsWith(`seasonal:${month}:`))
          .map((source) => [source, memory.id]),
      ),
    );
    await Promise.all(
      [...totals.entries()]
        .filter(([, total]) => total.recent.gt(0) && total.older.gt(0))
        .map(async ([categoryId, total]) => {
          const sourceRef = `seasonal:${month}:${categoryId}`;
          const data = {
            summary: `Recorded ${monthName} ${total.name} spending was ${total.recent.toFixed(2)} in ${recentYear} and ${total.older.toFixed(2)} in ${olderYear}. This is historical context, not a forecast.`,
            observedAt: new Date(Date.UTC(now.getUTCFullYear(), month, 1)),
            sourceRefs: [sourceRef],
          };
          const id = existingBySource.get(sourceRef);
          if (id) return this.prisma.advisorMemory.update({ where: { id }, data });
          return this.prisma.advisorMemory.create({
            data: { userId, kind: 'SEASONAL_PATTERN', ...data },
          });
        }),
    );
  }

  /** Stores a concise, explicit local observation; callers own its source references and expiry. */
  create(
    userId: string,
    input: { kind: AdvisorMemoryKind; summary: string; sourceRefs?: string[]; observedAt?: Date; expiresAt?: Date },
  ) {
    return this.prisma.advisorMemory.create({
      data: {
        userId,
        kind: input.kind,
        summary: input.summary,
        sourceRefs: input.sourceRefs ?? [],
        observedAt: input.observedAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  async remove(userId: string, id: string) {
    const deleted = await this.prisma.advisorMemory.deleteMany({ where: { id, userId } });
    if (deleted.count !== 1) throw new NotFoundException('Advisor memory entry is unavailable');
  }
}
