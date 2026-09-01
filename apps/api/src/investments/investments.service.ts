import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
const TYPES = ['BROKERAGE', 'RETIREMENT', 'CRYPTO'] as const;
@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string) {
    return this.prisma.investmentHolding.findMany({
      where: { account: { userId, type: { in: [...TYPES] }, isArchived: false } },
      include: {
        account: { select: { name: true, type: true, currency: true } },
        quoteSnapshots: { select: { price: true, source: true, asOf: true }, orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }], take: 2 },
      },
      orderBy: [{ accountId: 'asc' }, { symbol: 'asc' }],
    });
  }
  async create(
    userId: string,
    input: { accountId: string; symbol: string; quantity: string; costBasis?: string },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, userId, type: { in: [...TYPES] }, isArchived: false },
    });
    if (!account)
      throw new BadRequestException('Select an active brokerage, retirement, or crypto account');
    return this.prisma.investmentHolding.create({
      data: {
        accountId: input.accountId,
        symbol: input.symbol.trim().toUpperCase(),
        quantity: new Decimal(input.quantity),
        costBasis: input.costBasis ? new Decimal(input.costBasis) : null,
      },
    });
  }
  async remove(userId: string, id: string) {
    const holding = await this.prisma.investmentHolding.findFirst({
      where: { id, account: { userId } },
      select: { id: true },
    });
    if (!holding) throw new NotFoundException('Holding not found');
    await this.prisma.investmentHolding.delete({ where: { id } });
  }

  async update(
    userId: string,
    id: string,
    input: { quantity: string; costBasis?: string | null },
  ) {
    const holding = await this.prisma.investmentHolding.findFirst({
      where: { id, account: { userId, type: { in: [...TYPES] }, isArchived: false } },
      select: { id: true },
    });
    if (!holding) throw new NotFoundException('Holding not found');
    return this.prisma.investmentHolding.update({
      where: { id },
      data: {
        quantity: new Decimal(input.quantity),
        ...(input.costBasis !== undefined
          ? { costBasis: input.costBasis === null ? null : new Decimal(input.costBasis) }
          : {}),
      },
    });
  }

  async recordQuote(
    userId: string,
    id: string,
    input: { quotePrice: string; quoteSource?: string; quoteAsOf: string },
  ) {
    const holding = await this.prisma.investmentHolding.findFirst({
      where: { id, account: { userId, type: { in: [...TYPES] }, isArchived: false } },
      select: { id: true },
    });
    if (!holding) throw new NotFoundException('Holding not found');
    const price = new Decimal(input.quotePrice);
    const source = input.quoteSource?.trim() || 'Manual entry';
    const asOf = new Date(`${input.quoteAsOf}T00:00:00.000Z`);
    return this.prisma.$transaction(async (tx) => {
      await tx.investmentQuoteSnapshot.create({ data: { holdingId: id, price, source, asOf } });
      const latest = await tx.investmentQuoteSnapshot.findFirst({
        where: { holdingId: id },
        orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }],
      });
      if (!latest) throw new NotFoundException('Quote snapshot not found');
      return tx.investmentHolding.update({
        where: { id },
        data: { quotePrice: latest.price, quoteSource: latest.source, quoteAsOf: latest.asOf },
      });
    });
  }
}
