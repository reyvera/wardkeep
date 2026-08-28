import { Injectable } from '@nestjs/common';
import type {
  Capability,
  CapabilityContext,
  CapabilityMetadata,
  DashboardCard,
  Observation,
  Recommendation,
  Signal,
  TimelineEvent,
} from '@wardkeep/capability-sdk';

import { PrismaService } from '../prisma/prisma.service';
import { generateProsperitySignals, generateProvisionSignals } from '../readiness/generators';

export const financeCapabilityMetadata: CapabilityMetadata = {
  id: 'finance',
  name: 'Finance',
  pillars: ['provision', 'prosperity'],
  icon: 'wallet',
  description: 'Accounts, transactions, budgets, debt, cash flow, and savings goals.',
  source: 'core',
};

@Injectable()
export class FinanceCapability implements Capability {
  readonly metadata = financeCapabilityMetadata;

  constructor(private readonly prisma: PrismaService) {}

  async observations(context: CapabilityContext): Promise<Observation[]> {
    const [accounts, budgets, goals, recurring] = await Promise.all([
      this.prisma.account.count({ where: { userId: context.householdId, isArchived: false } }),
      this.prisma.budget.count({ where: { userId: context.householdId } }),
      this.prisma.financialGoal.count({ where: { userId: context.householdId, isActive: true } }),
      this.prisma.recurringTransaction.count({ where: { userId: context.householdId, isActive: true } }),
    ]);
    return [
      { capabilityId: this.metadata.id, fact: 'active financial accounts', value: accounts, observedAt: context.evaluatedAt, confidence: 1 },
      { capabilityId: this.metadata.id, fact: 'recorded budgets', value: budgets, observedAt: context.evaluatedAt, confidence: 1 },
      { capabilityId: this.metadata.id, fact: 'active financial goals', value: goals, observedAt: context.evaluatedAt, confidence: 1 },
      { capabilityId: this.metadata.id, fact: 'active recurring records', value: recurring, observedAt: context.evaluatedAt, confidence: 1 },
    ];
  }

  async signals(context: CapabilityContext): Promise<Signal[]> {
    const [provision, prosperity] = await Promise.all([
      generateProvisionSignals(this.prisma, context.householdId),
      generateProsperitySignals(this.prisma, context.householdId),
    ]);
    return [...provision, ...prosperity].map(({ capabilityId, type, magnitude, pillar, summary, expiresAt }) => ({
      capabilityId,
      type,
      magnitude,
      pillar,
      summary,
      ...(expiresAt ? { expiresAt } : {}),
    }));
  }

  async recommendations(context: CapabilityContext): Promise<Recommendation[]> {
    const risks = (await this.signals(context))
      .filter((signal) => signal.magnitude < 0)
      .sort((left, right) => left.magnitude - right.magnitude)
      .slice(0, 3);
    return risks.map((signal) => ({
      capabilityId: this.metadata.id,
      action: this.actionFor(signal.capabilityId),
      reasoning: signal.summary,
      priority: signal.magnitude <= -4 ? 'critical' : signal.magnitude <= -3 ? 'high' : 'medium',
      effort: 'small',
      impactEstimate: 'Improves the recorded financial readiness picture when the underlying record is updated.',
    }));
  }

  async dashboardCards(context: CapabilityContext): Promise<DashboardCard[]> {
    const [accounts, budgets, goals] = await Promise.all([
      this.prisma.account.count({ where: { userId: context.householdId, isArchived: false } }),
      this.prisma.budget.count({ where: { userId: context.householdId } }),
      this.prisma.financialGoal.count({ where: { userId: context.householdId, isActive: true } }),
    ]);
    return [
      { capabilityId: this.metadata.id, question: 'How much financial information is recorded?', answer: `${accounts} active accounts and ${budgets} recorded budgets.`, status: accounts > 0 ? 'good' : 'attention', metric: { value: String(accounts), label: 'active accounts' } },
      { capabilityId: this.metadata.id, question: 'What savings plans are active?', answer: `${goals} active financial goals are recorded.`, status: goals > 0 ? 'good' : 'attention', metric: { value: String(goals), label: 'active goals' } },
    ];
  }

  async timelineEvents(context: CapabilityContext): Promise<TimelineEvent[]> {
    const start = new Date(context.evaluatedAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 90);
    const [expenses, goals] = await Promise.all([
      this.prisma.plannedExpense.findMany({ where: { userId: context.householdId, isActive: true, dueDate: { gte: start, lte: end } }, orderBy: { dueDate: 'asc' } }),
      this.prisma.financialGoal.findMany({ where: { userId: context.householdId, isActive: true, targetDate: { gte: start, lte: end } }, orderBy: { targetDate: 'asc' } }),
    ]);
    return [
      ...expenses.map((expense) => ({ capabilityId: this.metadata.id, title: expense.name, description: 'Recorded planned expense due date.', date: expense.dueDate!, temporal: 'upcoming' as const, actionRequired: true })),
      ...goals.map((goal) => ({ capabilityId: this.metadata.id, title: goal.name, description: 'Recorded financial-goal target date.', date: goal.targetDate!, temporal: 'upcoming' as const, actionRequired: true })),
    ];
  }

  private actionFor(signalCapabilityId: string): string {
    if (signalCapabilityId === 'budgets') return 'Review budget';
    if (signalCapabilityId === 'cashflow') return 'Review cash flow';
    if (signalCapabilityId === 'debt') return 'Review debt plan';
    return 'Review accounts';
  }
}
