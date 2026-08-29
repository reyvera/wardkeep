import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

type PlanInput = {
  mode?: 'INCAPACITY_CONTINUITY' | 'AFTER_DEATH_SETTLEMENT';
  title?: string;
  reviewDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

@Injectable()
export class HouseholdTransitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.householdTransitionPlan.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { reviewDate: 'asc' }],
    });
  }

  /** A factual, read-only check of records a household may want to organize. */
  async readinessCheck(userId: string) {
    const [accounts, policies, obligations, estateDocuments, plans] = await Promise.all([
      this.prisma.account.count({ where: { userId, isArchived: false } }),
      this.prisma.insurancePolicy.count({ where: { userId, isActive: true } }),
      this.prisma.recurringTransaction.count({ where: { userId, isActive: true } }),
      this.prisma.estateDocument.count({ where: { userId, isActive: true } }),
      this.prisma.householdTransitionPlan.count({ where: { userId, isActive: true } }),
    ]);
    const checks = [
      this.check('accounts', 'Accounts and institutions', accounts, 'active account record'),
      this.check('insurance', 'Insurance policies and contacts', policies, 'active policy record'),
      this.check('obligations', 'Recurring obligations', obligations, 'active recurring obligation'),
      this.check('estate', 'Estate-document locations', estateDocuments, 'active estate-document record'),
      this.check('plan', 'Continuity plan', plans, 'active transition plan'),
    ];
    return { checks, recordedCount: checks.filter((check) => check.recorded).length, totalCount: checks.length };
  }

  create(userId: string, input: PlanInput & { mode: NonNullable<PlanInput['mode']>; title: string }) {
    return this.prisma.householdTransitionPlan.create({
      data: { userId, mode: input.mode, title: input.title, reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null, notes: input.notes ?? null },
    });
  }

  async update(userId: string, id: string, input: PlanInput) {
    const plan = await this.prisma.householdTransitionPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Household transition plan not found');
    return this.prisma.householdTransitionPlan.update({
      where: { id },
      data: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.reviewDate !== undefined ? { reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const plan = await this.prisma.householdTransitionPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Household transition plan not found');
    await this.prisma.householdTransitionPlan.delete({ where: { id } });
  }

  private check(id: string, label: string, count: number, noun: string) {
    return { id, label, recorded: count > 0, detail: count ? `${count} ${noun}${count === 1 ? '' : 's'} found.` : `No ${noun}s found.` };
  }
}
