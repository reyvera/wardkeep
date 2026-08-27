import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type GoalInput = {
  name?: string;
  targetAmount?: string | null;
  savedAmount?: string | null;
  targetDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

@Injectable()
export class FinancialGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.financialGoal.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { targetDate: 'asc' }],
    });
  }

  create(userId: string, input: GoalInput & { name: string }) {
    return this.prisma.financialGoal.create({
      data: {
        userId,
        name: input.name,
        targetAmount: input.targetAmount ? new Decimal(input.targetAmount) : null,
        savedAmount: input.savedAmount ? new Decimal(input.savedAmount) : new Decimal(0),
        targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00.000Z`) : null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: GoalInput) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Financial goal not found');
    return this.prisma.financialGoal.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.targetAmount !== undefined
          ? { targetAmount: input.targetAmount ? new Decimal(input.targetAmount) : null }
          : {}),
        ...(input.savedAmount !== undefined
          ? { savedAmount: input.savedAmount ? new Decimal(input.savedAmount) : new Decimal(0) }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00.000Z`) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Financial goal not found');
    await this.prisma.financialGoal.delete({ where: { id } });
  }
}
