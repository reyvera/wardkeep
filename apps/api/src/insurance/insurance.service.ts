import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto } from './dto/insurance-policy.dto';

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const policies = await this.prisma.insurancePolicy.findMany({
      where: { userId },
      include: { paymentAccount: { select: { name: true, type: true } } },
      orderBy: [{ isActive: 'desc' }, { renewalDate: 'asc' }],
    });
    return policies.map((policy) => this.serialize(policy));
  }

  async create(userId: string, dto: CreateInsurancePolicyDto) {
    await this.assertPaymentAccount(userId, dto.paymentAccountId);
    const policy = await this.prisma.insurancePolicy.create({
      data: {
        userId,
        type: dto.type,
        provider: dto.provider,
        nickname: dto.nickname || null,
        premium: dto.premium ? new Decimal(dto.premium) : null,
        premiumFrequency: dto.premiumFrequency,
        paymentArrangement: dto.paymentArrangement,
        paymentAccountId: dto.paymentAccountId || null,
        propertyTaxEscrow: dto.propertyTaxEscrow ? new Decimal(dto.propertyTaxEscrow) : null,
        propertyTaxFrequency: dto.propertyTaxFrequency,
        deductible: dto.deductible ? new Decimal(dto.deductible) : null,
        coverageAmount: dto.coverageAmount ? new Decimal(dto.coverageAmount) : null,
        renewalDate: dto.renewalDate ? new Date(`${dto.renewalDate}T00:00:00.000Z`) : null,
        notes: dto.notes || null,
      },
      include: { paymentAccount: { select: { name: true, type: true } } },
    });
    return this.serialize(policy);
  }

  async update(userId: string, id: string, dto: UpdateInsurancePolicyDto) {
    const existing = await this.prisma.insurancePolicy.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Insurance policy not found');
    await this.assertPaymentAccount(userId, dto.paymentAccountId);
    const policy = await this.prisma.insurancePolicy.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.premium !== undefined && {
          premium: dto.premium === null ? null : new Decimal(dto.premium),
        }),
        ...(dto.deductible !== undefined && {
          deductible: dto.deductible === null ? null : new Decimal(dto.deductible),
        }),
        ...(dto.coverageAmount !== undefined && {
          coverageAmount: dto.coverageAmount === null ? null : new Decimal(dto.coverageAmount),
        }),
        ...(dto.propertyTaxEscrow !== undefined && {
          propertyTaxEscrow:
            dto.propertyTaxEscrow === null ? null : new Decimal(dto.propertyTaxEscrow),
        }),
        ...(dto.renewalDate !== undefined && {
          renewalDate:
            dto.renewalDate === null ? null : new Date(`${dto.renewalDate}T00:00:00.000Z`),
        }),
      },
      include: { paymentAccount: { select: { name: true, type: true } } },
    });
    return this.serialize(policy);
  }

  async remove(userId: string, id: string) {
    const policy = await this.prisma.insurancePolicy.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!policy) throw new NotFoundException('Insurance policy not found');
    await this.prisma.insurancePolicy.delete({ where: { id } });
  }

  private async assertPaymentAccount(userId: string, accountId: string | null | undefined) {
    if (!accountId) return;
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Bundled payment account not found');
  }

  private serialize(policy: {
    id: string;
    userId: string;
    type: string;
    provider: string;
    nickname: string | null;
    premium: { toString(): string } | null;
    premiumFrequency: string;
    paymentArrangement: string;
    paymentAccountId: string | null;
    paymentAccount?: { name: string; type: string } | null;
    propertyTaxEscrow: { toString(): string } | null;
    propertyTaxFrequency: string | null;
    deductible: { toString(): string } | null;
    coverageAmount: { toString(): string } | null;
    renewalDate: Date | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...policy,
      premium: policy.premium?.toString() ?? null,
      deductible: policy.deductible?.toString() ?? null,
      coverageAmount: policy.coverageAmount?.toString() ?? null,
      propertyTaxEscrow: policy.propertyTaxEscrow?.toString() ?? null,
    };
  }
}
