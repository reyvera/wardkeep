import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { FinanceCapability } from './finance.capability';

describe('FinanceCapability', () => {
  it('returns household-scoped observations, dashboard cards, and upcoming financial events', async () => {
    const prisma = {
      account: { count: vi.fn().mockResolvedValue(3) },
      budget: { count: vi.fn().mockResolvedValue(1) },
      financialGoal: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([{ id: 'goal-1', name: 'Emergency reserve', targetDate: new Date('2026-09-15') }]),
      },
      recurringTransaction: { count: vi.fn().mockResolvedValue(4) },
      plannedExpense: {
        findMany: vi.fn().mockResolvedValue([{ id: 'expense-1', name: 'Car registration', dueDate: new Date('2026-09-10') }]),
      },
    } as unknown as PrismaService;
    const capability = new FinanceCapability(prisma);
    const context = { householdId: 'household-1', evaluatedAt: new Date('2026-08-28T12:00:00.000Z') };

    await expect(capability.observations(context)).resolves.toContainEqual(expect.objectContaining({
      capabilityId: 'finance', fact: 'active financial accounts', value: 3,
    }));
    await expect(capability.dashboardCards(context)).resolves.toContainEqual(expect.objectContaining({
      metric: { value: '3', label: 'active accounts' },
    }));
    await expect(capability.timelineEvents(context)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Car registration', capabilityId: 'finance' }),
      expect.objectContaining({ title: 'Emergency reserve', capabilityId: 'finance' }),
    ]));
    expect(prisma.account.count).toHaveBeenCalledWith({ where: { userId: 'household-1', isArchived: false } });
  });
});
