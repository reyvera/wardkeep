import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

export interface HouseholdObligationInput {
  name?: string;
  monthlyAmount?: string;
  isVariable?: boolean;
  reviewDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

@Injectable()
export class HouseholdObligationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const obligations = await this.prisma.householdObligation.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return obligations.map((obligation) => this.serialize(obligation));
  }

  async create(userId: string, dto: Required<Pick<HouseholdObligationInput, 'name' | 'monthlyAmount'>> & HouseholdObligationInput) {
    const obligation = await this.prisma.householdObligation.create({
      data: {
        userId,
        name: dto.name,
        monthlyAmount: new Decimal(dto.monthlyAmount),
        isVariable: dto.isVariable ?? false,
        reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null,
        notes: dto.notes || null,
      },
    });
    return this.serialize(obligation);
  }

  async update(userId: string, id: string, dto: HouseholdObligationInput) {
    const existing = await this.prisma.householdObligation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Household obligation not found');
    const obligation = await this.prisma.householdObligation.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.monthlyAmount !== undefined && { monthlyAmount: new Decimal(dto.monthlyAmount) }),
        ...(dto.reviewDate !== undefined && {
          reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null,
        }),
      },
    });
    return this.serialize(obligation);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.householdObligation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Household obligation not found');
    await this.prisma.householdObligation.delete({ where: { id } });
  }

  private serialize(obligation: { monthlyAmount: { toString(): string } }) {
    return { ...obligation, monthlyAmount: obligation.monthlyAmount.toString() };
  }
}
