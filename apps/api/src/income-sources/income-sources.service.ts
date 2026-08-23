import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';

type IncomeSourceInput = {
  name?: string;
  kind?: 'EMPLOYMENT' | 'SELF_EMPLOYMENT' | 'BENEFIT' | 'SUPPORT' | 'OTHER';
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' | 'CUSTOM';
  expectedNetAmount?: string | null;
  nextExpectedDate?: string | null;
  reviewDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
};
@Injectable()
export class IncomeSourcesService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.incomeSource.findMany({ where: { userId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }); }
  create(userId: string, dto: IncomeSourceInput & { name: string; frequency: NonNullable<IncomeSourceInput['frequency']> }) { return this.prisma.incomeSource.create({ data: { ...dto, userId, expectedNetAmount: dto.expectedNetAmount ? new Decimal(dto.expectedNetAmount) : null, nextExpectedDate: dto.nextExpectedDate ? new Date(`${dto.nextExpectedDate}T00:00:00.000Z`) : null, reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null } }); }
  async update(userId: string, id: string, dto: IncomeSourceInput) { const existing = await this.prisma.incomeSource.findFirst({ where: { id, userId }, select: { id: true } }); if (!existing) throw new NotFoundException('Income source not found'); return this.prisma.incomeSource.update({ where: { id }, data: { ...dto, ...(dto.expectedNetAmount !== undefined && { expectedNetAmount: dto.expectedNetAmount ? new Decimal(dto.expectedNetAmount) : null }), ...(dto.nextExpectedDate !== undefined && { nextExpectedDate: dto.nextExpectedDate ? new Date(`${dto.nextExpectedDate}T00:00:00.000Z`) : null }), ...(dto.reviewDate !== undefined && { reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null }) } }); }
  async remove(userId: string, id: string) { const existing = await this.prisma.incomeSource.findFirst({ where: { id, userId }, select: { id: true } }); if (!existing) throw new NotFoundException('Income source not found'); await this.prisma.incomeSource.delete({ where: { id } }); }
}
