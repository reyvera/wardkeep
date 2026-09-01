import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { calculateBalance } from '@wardkeep/finance-engine';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class RealEstateService {
  constructor(private readonly prisma: PrismaService) {}
  async equity(userId: string, accountId: string) {
    const profile = await this.prisma.realEstateProfile.findFirst({
      where: { accountId, account: { userId, type: 'REAL_ESTATE' } },
    });
    if (!profile) throw new NotFoundException('Property profile not found');
    const mortgage = profile.mortgageAccountId
      ? await this.prisma.account.findFirst({
          where: { id: profile.mortgageAccountId, userId, type: 'MORTGAGE' },
          include: { transactions: true, linkedBankAccounts: { select: { id: true } } },
        })
      : null;
    const balance = mortgage ? this.mortgageBalance(mortgage) : new Decimal(0);
    return {
      recordedValue: profile.recordedValue.toString(),
      valuationDate: profile.valuationDate,
      mortgageBalance: balance.toFixed(2),
      equity: new Decimal(profile.recordedValue.toString()).minus(balance).toFixed(2),
      limitation: 'Uses owner-recorded property value and the current linked mortgage balance.',
    };
  }

  async list(userId: string) {
    const profiles = await this.prisma.realEstateProfile.findMany({
      where: { account: { userId, type: 'REAL_ESTATE', isArchived: false } },
      select: {
        id: true,
        accountId: true,
        mortgageAccountId: true,
        recordedValue: true,
        valuationDate: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const mortgageIds = profiles
      .map((profile) => profile.mortgageAccountId)
      .filter((id): id is string => id !== null);
    const mortgages = mortgageIds.length
      ? await this.prisma.account.findMany({
          where: { id: { in: mortgageIds }, userId, type: 'MORTGAGE' },
          include: { transactions: true, linkedBankAccounts: { select: { id: true } } },
        })
      : [];
    const mortgageById = new Map(mortgages.map((mortgage) => [mortgage.id, mortgage]));
    return profiles.map((profile) => {
      const mortgage = profile.mortgageAccountId
        ? mortgageById.get(profile.mortgageAccountId)
        : null;
      const mortgageBalance = mortgage ? this.mortgageBalance(mortgage) : new Decimal(0);
      return {
        ...profile,
        recordedValue: profile.recordedValue.toFixed(2),
        mortgageBalance: mortgageBalance.toFixed(2),
        equity: new Decimal(profile.recordedValue.toString()).minus(mortgageBalance).toFixed(2),
        limitation: 'Owner-recorded property value; mortgage balance reflects linked account data.',
      };
    });
  }
  async upsert(
    userId: string,
    accountId: string,
    input: { recordedValue: string; valuationDate: string; mortgageAccountId?: string | null },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, type: 'REAL_ESTATE' },
    });
    if (!account) throw new NotFoundException('Real estate account not found');
    if (input.mortgageAccountId) {
      const mortgage = await this.prisma.account.findFirst({
        where: { id: input.mortgageAccountId, userId, type: 'MORTGAGE' },
      });
      if (!mortgage) throw new NotFoundException('Mortgage account not found');
    }
    return this.prisma.realEstateProfile.upsert({
      where: { accountId },
      create: {
        accountId,
        recordedValue: new Decimal(input.recordedValue),
        valuationDate: new Date(`${input.valuationDate}T00:00:00.000Z`),
        mortgageAccountId: input.mortgageAccountId ?? null,
      },
      update: {
        recordedValue: new Decimal(input.recordedValue),
        valuationDate: new Date(`${input.valuationDate}T00:00:00.000Z`),
        mortgageAccountId: input.mortgageAccountId ?? null,
      },
    });
  }

  async remove(userId: string, accountId: string) {
    const profile = await this.prisma.realEstateProfile.findFirst({
      where: { accountId, account: { userId, type: 'REAL_ESTATE' } },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Property profile not found');
    await this.prisma.realEstateProfile.delete({ where: { id: profile.id } });
  }

  private mortgageBalance(account: {
    initialBalance: { toString(): string };
    transactions: Array<{ amount: { toString(): string }; aiConfidence: { toString(): string } | null; [key: string]: unknown }>;
    linkedBankAccounts: Array<{ id: string }>;
  }): Decimal {
    // Keep the liability calculation identical to Accounts: a bank-linked balance is
    // already current, while manual accounts are derived from their transactions.
    if (account.linkedBankAccounts.length > 0) {
      return new Decimal(account.initialBalance.toString()).abs();
    }
    const computed = calculateBalance(
      new Decimal(account.initialBalance.toString()),
      account.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toString(),
        aiConfidence: transaction.aiConfidence?.toString() ?? null,
      })) as unknown as Parameters<typeof calculateBalance>[1],
    );
    return computed.abs();
  }
}
