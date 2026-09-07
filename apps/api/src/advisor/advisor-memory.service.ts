import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvisorMemoryKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdvisorMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns only current household-local entries; expired memory is never surfaced. */
  async list(userId: string, now = new Date()) {
    await this.prisma.advisorMemory.deleteMany({ where: { userId, expiresAt: { lte: now } } });
    await this.syncAnnualRecurringEvents(userId);
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
