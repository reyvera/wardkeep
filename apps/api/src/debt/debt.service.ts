import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  calculatePayoffSchedule,
  compareStrategies,
  calculateConsolidation,
  calculateMinimumOnlyPayoff,
  calculateVelocityBanking,
  calculateBalance,
  Debt,
  PayoffStrategy,
} from '@wardkeep/finance-engine';
import { DEBT_ACCOUNT_TYPES } from '@wardkeep/shared';

import { PrismaService } from '../prisma/prisma.service';
import {
  CalculateDebtDto,
  CompareDebtDto,
  ConsolidationDto,
  VelocityBankingDto,
  MinimumOnlyDto,
} from './dto/calculate-debt.dto';
import { CreateDebtProfileDto, UpdateDebtProfileDto, CreatePayoffPlanDto } from './dto/debt-profile.dto';

@Injectable()
export class DebtService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Debt Profile CRUD ──────────────────────────────────────────────────────

  /**
   * Lists all debt profiles for a user, joined with account data.
   * Computes current balance for each linked account.
   * @param userId - The authenticated user's ID
   * @returns Array of debt profiles with account name, type, and current balance
   */
  async listProfiles(userId: string) {
    const profiles = await this.prisma.debtProfile.findMany({
      where: { userId },
      include: {
        account: {
          include: {
            transactions: true,
            linkedBankAccounts: { select: { id: true } },
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    return profiles.map((profile) => {
      const currentBalance = this.computeAccountBalance(profile.account);

      return {
        id: profile.id,
        userId: profile.userId,
        accountId: profile.accountId,
        accountName: profile.account.name,
        accountType: profile.account.type,
        apr: profile.apr.toString(),
        minimumPayment: profile.minimumPayment.toString(),
        assetValue: profile.assetValue?.toString() ?? null,
        priority: profile.priority,
        currentBalance,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };
    });
  }

  /**
   * Creates a debt profile for the given account.
   * Validates that the account belongs to the user and is a liability type.
   * @param userId - The authenticated user's ID
   * @param dto - The debt profile creation data
   * @returns The newly created debt profile
   */
  async createProfile(userId: string, dto: CreateDebtProfileDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const debtTypes: string[] = DEBT_ACCOUNT_TYPES;
    if (!debtTypes.includes(account.type)) {
      throw new BadRequestException(
        `Account type "${account.type}" is not a liability type. Debt profiles can only be created for: ${DEBT_ACCOUNT_TYPES.join(', ')}`,
      );
    }

    const existing = await this.prisma.debtProfile.findUnique({
      where: { accountId: dto.accountId },
    });

    if (existing) {
      throw new ConflictException('A debt profile already exists for this account');
    }

    // Store APR as decimal fraction (divide percentage by 100)
    const aprDecimal = new Decimal(dto.apr).div(100);

    const profile = await this.prisma.debtProfile.create({
      data: {
        userId,
        accountId: dto.accountId,
        apr: aprDecimal,
        minimumPayment: new Decimal(dto.minimumPayment),
        assetValue: dto.assetValue ? new Decimal(dto.assetValue) : null,
        priority: dto.priority ?? 0,
      },
    });

    return {
      id: profile.id,
      userId: profile.userId,
      accountId: profile.accountId,
      accountName: account.name,
      accountType: account.type,
      apr: profile.apr.toString(),
      minimumPayment: profile.minimumPayment.toString(),
      assetValue: profile.assetValue?.toString() ?? null,
      priority: profile.priority,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Updates an existing debt profile.
   * @param userId - The authenticated user's ID
   * @param profileId - The debt profile ID to update
   * @param dto - The fields to update
   * @returns The updated debt profile
   */
  async updateProfile(userId: string, profileId: string, dto: UpdateDebtProfileDto) {
    const profile = await this.prisma.debtProfile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundException('Debt profile not found');
    }

    const updated = await this.prisma.debtProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.apr !== undefined && { apr: new Decimal(dto.apr).div(100) }),
        ...(dto.minimumPayment !== undefined && {
          minimumPayment: new Decimal(dto.minimumPayment),
        }),
        ...(dto.assetValue !== undefined && {
          assetValue: dto.assetValue === null ? null : new Decimal(dto.assetValue),
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
      },
      include: { account: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      accountName: updated.account.name,
      accountType: updated.account.type,
      apr: updated.apr.toString(),
      minimumPayment: updated.minimumPayment.toString(),
      assetValue: updated.assetValue?.toString() ?? null,
      priority: updated.priority,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Deletes a debt profile.
   * @param userId - The authenticated user's ID
   * @param profileId - The debt profile ID to delete
   */
  async deleteProfile(userId: string, profileId: string) {
    const profile = await this.prisma.debtProfile.findFirst({
      where: { id: profileId, userId },
    });

    if (!profile) {
      throw new NotFoundException('Debt profile not found');
    }

    await this.prisma.debtProfile.delete({ where: { id: profileId } });
  }

  // ─── Auto-Sync: Debts from Accounts ────────────────────────────────────────

  /**
   * Fetches all liability accounts for the user, auto-creating debt profiles
   * for any that don't have one yet. Returns them in the Debt[] format
   * expected by the finance engine.
   * @param userId - The authenticated user's ID
   * @returns Array of debts ready for the payoff calculator
   */
  async getDebtsFromAccounts(userId: string) {
    // Auto-create profiles for liability accounts that don't have one
    const debtTypes: string[] = DEBT_ACCOUNT_TYPES;

    try {
      const liabilityAccounts = await this.prisma.account.findMany({
        where: {
          userId,
          type: { in: debtTypes },
          isArchived: false,
        },
        select: { id: true },
      });

      const existingProfiles = await this.prisma.debtProfile.findMany({
        where: { userId },
        select: { accountId: true },
      });

      const existingAccountIds = new Set(existingProfiles.map((p) => p.accountId));
      const missingAccountIds = liabilityAccounts
        .filter((a) => !existingAccountIds.has(a.id))
        .map((a) => a.id);

      if (missingAccountIds.length > 0) {
        await this.prisma.$transaction(
          missingAccountIds.map((accountId, index) =>
            this.prisma.debtProfile.create({
              data: {
                userId,
                accountId,
                apr: new Decimal(0),
                minimumPayment: new Decimal(0),
                priority: existingProfiles.length + index + 1,
              },
            }),
          ),
        );
      }
    } catch {
      // Non-fatal: if auto-creation fails, we still return existing profiles
    }

    // Now fetch all profiles with full data
    const profiles = await this.prisma.debtProfile.findMany({
      where: { userId },
      include: {
        account: {
          include: {
            transactions: true,
            linkedBankAccounts: { select: { id: true } },
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    return profiles
      .filter((p) => !p.account.isArchived)
      .map((profile) => {
        const currentBalance = this.computeAccountBalance(profile.account);

        return {
          id: profile.accountId,
          name: profile.account.name,
          balance: currentBalance,
          apr: profile.apr.toString(),
          minimumPayment: profile.minimumPayment.toString(),
          priority: profile.priority,
        };
      });
  }

  // ─── Saved Payoff Plans ──────────────────────────────────────────────────────

  /**
   * Lists all saved payoff plans for a user, ordered by creation date.
   * @param userId - The authenticated user's ID
   * @returns Array of saved plans
   */
  async listPlans(userId: string) {
    const plans = await this.prisma.savedPayoffPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      userId: plan.userId,
      name: plan.name,
      accountIds: plan.accountIds,
      strategy: plan.strategy,
      totalMonthlyPayment: plan.totalMonthlyPayment.toString(),
      totalInterest: plan.totalInterest.toString(),
      totalMonths: plan.totalMonths,
      createdAt: plan.createdAt,
    }));
  }

  /**
   * Saves a payoff plan with the selected accounts, strategy, and results.
   * @param userId - The authenticated user's ID
   * @param dto - The plan data to save
   * @returns The saved plan
   */
  async createPlan(userId: string, dto: CreatePayoffPlanDto) {
    const plan = await this.prisma.savedPayoffPlan.create({
      data: {
        userId,
        name: dto.name,
        accountIds: dto.accountIds,
        strategy: dto.strategy,
        totalMonthlyPayment: new Decimal(dto.totalMonthlyPayment),
        totalInterest: new Decimal(dto.totalInterest),
        totalMonths: dto.totalMonths,
      },
    });

    return {
      id: plan.id,
      userId: plan.userId,
      name: plan.name,
      accountIds: plan.accountIds,
      strategy: plan.strategy,
      totalMonthlyPayment: plan.totalMonthlyPayment.toString(),
      totalInterest: plan.totalInterest.toString(),
      totalMonths: plan.totalMonths,
      createdAt: plan.createdAt,
    };
  }

  /**
   * Deletes a saved payoff plan.
   * @param userId - The authenticated user's ID
   * @param planId - The plan ID to delete
   */
  async deletePlan(userId: string, planId: string) {
    const plan = await this.prisma.savedPayoffPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      throw new NotFoundException('Payoff plan not found');
    }

    await this.prisma.savedPayoffPlan.delete({ where: { id: planId } });
  }

  // ─── Payoff Calculations (existing) ─────────────────────────────────────────

  /**
   * Calculates a debt payoff schedule for the given debts and strategy.
   * Delegates to the finance engine and serializes Decimal results.
   * @param dto - The debts, strategy, and total monthly payment
   * @returns Serialized payoff schedule with string amounts
   */
  calculate(dto: CalculateDebtDto) {
    const debts: Debt[] = dto.debts.map((d: CalculateDebtDto['debts'][number]) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = calculatePayoffSchedule(
      debts,
      dto.strategy as PayoffStrategy,
      new Decimal(dto.totalMonthlyPayment),
    );

    return this.serializePayoffResult(result);
  }

  /**
   * Compares multiple debt payoff strategies for the given debts.
   * Delegates to the finance engine and serializes Decimal results.
   * @param dto - The debts, strategies to compare, and total monthly payment
   * @returns Serialized comparison results with string amounts
   */
  compare(dto: CompareDebtDto) {
    const debts: Debt[] = dto.debts.map((d: CompareDebtDto['debts'][number]) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = compareStrategies(
      debts,
      dto.strategies as PayoffStrategy[],
      new Decimal(dto.totalMonthlyPayment),
    );

    return {
      strategies: result.strategies.map((s) => ({
        strategy: s.strategy,
        result: this.serializePayoffResult(s.result),
      })),
      interestSavings: result.interestSavings.toFixed(2),
      timeSavings: result.timeSavings,
    };
  }

  /**
   * Runs a what-if simulation (same as calculate, pure function with no side effects).
   * @param dto - The debts, strategy, and total monthly payment
   * @returns Serialized payoff schedule with string amounts
   */
  whatIf(dto: CalculateDebtDto) {
    return this.calculate(dto);
  }

  // ─── New Strategies ─────────────────────────────────────────────────────────

  /**
   * Calculates a debt consolidation scenario.
   * Models combining all debts into a single fixed-rate loan.
   * @param dto - The debts and consolidation parameters
   * @returns Serialized consolidation result with comparison to baseline
   */
  consolidation(dto: ConsolidationDto) {
    const debts: Debt[] = dto.debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = calculateConsolidation(debts, {
      newApr: dto.newApr,
      termMonths: dto.termMonths,
      originationFee: dto.originationFee,
    });

    return {
      schedule: {
        debtId: result.schedule.debtId,
        debtName: result.schedule.debtName,
        months: result.schedule.months.map((m) => ({
          month: m.month,
          debtId: m.debtId,
          payment: m.payment.toFixed(2),
          principal: m.principal.toFixed(2),
          interest: m.interest.toFixed(2),
          remainingBalance: m.remainingBalance.toFixed(2),
        })),
        totalInterest: result.schedule.totalInterest.toFixed(2),
        totalPaid: result.schedule.totalPaid.toFixed(2),
        payoffMonth: result.schedule.payoffMonth,
      },
      monthlyPayment: result.monthlyPayment.toFixed(2),
      totalInterest: result.totalInterest.toFixed(2),
      totalCost: result.totalCost.toFixed(2),
      interestSavingsVsBaseline: result.interestSavingsVsBaseline.toFixed(2),
      timeSavingsVsBaseline: result.timeSavingsVsBaseline,
      ...(result.warning && { warning: result.warning }),
    };
  }

  /**
   * Calculates a velocity banking scenario using a HELOC.
   * @param dto - The debts and velocity banking parameters
   * @returns Serialized velocity banking result with comparison to baseline
   */
  velocityBanking(dto: VelocityBankingDto) {
    const debts: Debt[] = dto.debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = calculateVelocityBanking(debts, {
      helocLimit: dto.helocLimit,
      helocApr: dto.helocApr,
      monthlyDisposableIncome: dto.monthlyDisposableIncome,
      chunkAmount: dto.chunkAmount,
    });

    return {
      schedules: result.schedules.map((s) => ({
        debtId: s.debtId,
        debtName: s.debtName,
        months: s.months.map((m) => ({
          month: m.month,
          debtId: m.debtId,
          payment: m.payment.toFixed(2),
          principal: m.principal.toFixed(2),
          interest: m.interest.toFixed(2),
          remainingBalance: m.remainingBalance.toFixed(2),
        })),
        totalInterest: s.totalInterest.toFixed(2),
        totalPaid: s.totalPaid.toFixed(2),
        payoffMonth: s.payoffMonth,
      })),
      totalInterest: result.totalInterest.toFixed(2),
      helocInterest: result.helocInterest.toFixed(2),
      combinedInterest: result.combinedInterest.toFixed(2),
      totalMonths: result.totalMonths,
      interestSavingsVsBaseline: result.interestSavingsVsBaseline.toFixed(2),
      timeSavingsVsBaseline: result.timeSavingsVsBaseline,
      ...(result.warning && { warning: result.warning }),
    };
  }

  /**
   * Calculates the minimum-only payoff baseline (no extra payments).
   * @param dto - The debts to calculate for
   * @returns Serialized payoff schedule using only minimum payments
   */
  minimumOnly(dto: MinimumOnlyDto) {
    const debts: Debt[] = dto.debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = calculateMinimumOnlyPayoff(debts);
    return this.serializePayoffResult(result);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Computes the current balance of an account from its transactions.
   * Bank-linked accounts use initialBalance; manual accounts compute from transactions.
   * @param account - The account with transactions and linkedBankAccounts
   * @returns The current balance as a fixed-point string
   */
  private computeAccountBalance(account: {
    initialBalance: unknown;
    transactions: Array<{ amount: unknown; type: unknown; aiConfidence: unknown; [key: string]: unknown }>;
    linkedBankAccounts: Array<{ id: string }>;
  }): string {
    if (account.linkedBankAccounts.length > 0) {
      return new Decimal(account.initialBalance as string).abs().toFixed(2);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs = account.transactions.map((tx: any) => ({
      ...tx,
      amount: tx.amount.toString(),
      aiConfidence: tx.aiConfidence?.toString() ?? null,
    }));

    const balance = calculateBalance(
      new Decimal(account.initialBalance as string),
      txs as Parameters<typeof calculateBalance>[1],
    );

    return balance.abs().toFixed(2);
  }

  /**
   * Serializes a PayoffResult, converting all Decimal values to fixed-point strings.
   * @param result - The raw payoff result from the finance engine
   * @returns Object with all Decimal values converted to strings
   */
  private serializePayoffResult(result: {
    schedules: Array<{
      debtId: string;
      debtName: string;
      months: Array<{
        month: number;
        debtId: string;
        payment: Decimal;
        principal: Decimal;
        interest: Decimal;
        remainingBalance: Decimal;
      }>;
      totalInterest: Decimal;
      totalPaid: Decimal;
      payoffMonth: number;
    }>;
    totalInterest: Decimal;
    totalMonths: number;
    debtFreeDate: number;
    warning?: string;
  }) {
    return {
      schedules: result.schedules.map((s) => ({
        debtId: s.debtId,
        debtName: s.debtName,
        months: s.months.map((m) => ({
          month: m.month,
          debtId: m.debtId,
          payment: m.payment.toFixed(2),
          principal: m.principal.toFixed(2),
          interest: m.interest.toFixed(2),
          remainingBalance: m.remainingBalance.toFixed(2),
        })),
        totalInterest: s.totalInterest.toFixed(2),
        totalPaid: s.totalPaid.toFixed(2),
        payoffMonth: s.payoffMonth,
      })),
      totalInterest: result.totalInterest.toFixed(2),
      totalMonths: result.totalMonths,
      debtFreeDate: result.debtFreeDate,
      ...(result.warning && { warning: result.warning }),
    };
  }
}
