import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto } from './dto/insurance-policy.dto';

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const policies = await this.prisma.insurancePolicy.findMany({ where: { userId }, orderBy: [{ isActive: 'desc' }, { renewalDate: 'asc' }] });
    return policies.map((policy) => this.serialize(policy));
  }

  async create(userId: string, dto: CreateInsurancePolicyDto) {
    const policy = await this.prisma.insurancePolicy.create({ data: {
      userId, type: dto.type, provider: dto.provider, nickname: dto.nickname || null,
      premium: dto.premium ? new Decimal(dto.premium) : null,
      premiumFrequency: dto.premiumFrequency,
      deductible: dto.deductible ? new Decimal(dto.deductible) : null,
      coverageAmount: dto.coverageAmount ? new Decimal(dto.coverageAmount) : null,
      renewalDate: dto.renewalDate ? new Date(`${dto.renewalDate}T00:00:00.000Z`) : null,
      notes: dto.notes || null,
    } });
    return this.serialize(policy);
  }

  async update(userId: string, id: string, dto: UpdateInsurancePolicyDto) {
    const existing = await this.prisma.insurancePolicy.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Insurance policy not found');
    const policy = await this.prisma.insurancePolicy.update({ where: { id }, data: {
      ...dto,
      ...(dto.premium !== undefined && { premium: dto.premium === null ? null : new Decimal(dto.premium) }),
      ...(dto.deductible !== undefined && { deductible: dto.deductible === null ? null : new Decimal(dto.deductible) }),
      ...(dto.coverageAmount !== undefined && { coverageAmount: dto.coverageAmount === null ? null : new Decimal(dto.coverageAmount) }),
      ...(dto.renewalDate !== undefined && { renewalDate: dto.renewalDate === null ? null : new Date(`${dto.renewalDate}T00:00:00.000Z`) }),
    } });
    return this.serialize(policy);
  }

  async remove(userId: string, id: string) {
    const policy = await this.prisma.insurancePolicy.findFirst({ where: { id, userId }, select: { id: true } });
    if (!policy) throw new NotFoundException('Insurance policy not found');
    await this.prisma.insurancePolicy.delete({ where: { id } });
  }

  private serialize(policy: { id: string; userId: string; type: string; provider: string; nickname: string | null; premium: { toString(): string } | null; premiumFrequency: string; deductible: { toString(): string } | null; coverageAmount: { toString(): string } | null; renewalDate: Date | null; isActive: boolean; notes: string | null; createdAt: Date; updatedAt: Date }) {
    return { ...policy, premium: policy.premium?.toString() ?? null, deductible: policy.deductible?.toString() ?? null, coverageAmount: policy.coverageAmount?.toString() ?? null };
  }
}
