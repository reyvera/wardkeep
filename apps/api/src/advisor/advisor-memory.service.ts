import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvisorMemoryKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdvisorMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns only current household-local entries; expired memory is never surfaced. */
  list(userId: string, now = new Date()) {
    return this.prisma.advisorMemory.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });
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
