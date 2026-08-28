import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type AssetInput = { name?: string; type?: string; installedAt?: string | null; expectedLifespanYears?: number | null; replacementCost?: string | null; isActive?: boolean; notes?: string | null };
type TaskInput = { homeAssetId?: string | null; name?: string; dueDate?: string | null; completedAt?: string | null; estimatedCost?: string | null; actualCost?: string | null; notes?: string | null };
const date = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00.000Z`) : null;

@Injectable()
export class HomeMaintenanceService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.homeAsset.findMany({ where: { userId }, include: { tasks: { orderBy: { dueDate: 'asc' } } }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }); }
  listTasks(userId: string) { return this.prisma.homeMaintenanceTask.findMany({ where: { userId }, include: { homeAsset: true }, orderBy: { dueDate: 'asc' } }); }
  createAsset(userId: string, input: AssetInput & { name: string; type: string }) { return this.prisma.homeAsset.create({ data: { userId, name: input.name, type: input.type, installedAt: date(input.installedAt), expectedLifespanYears: input.expectedLifespanYears ?? null, replacementCost: input.replacementCost ? new Decimal(input.replacementCost) : null, notes: input.notes ?? null } }); }
  async updateAsset(userId: string, id: string, input: AssetInput) { await this.asset(userId, id); return this.prisma.homeAsset.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.type !== undefined ? { type: input.type } : {}), ...(input.installedAt !== undefined ? { installedAt: date(input.installedAt) } : {}), ...(input.expectedLifespanYears !== undefined ? { expectedLifespanYears: input.expectedLifespanYears } : {}), ...(input.replacementCost !== undefined ? { replacementCost: input.replacementCost ? new Decimal(input.replacementCost) : null } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) } }); }
  async removeAsset(userId: string, id: string) { await this.asset(userId, id); await this.prisma.homeAsset.delete({ where: { id } }); }
  async createTask(userId: string, input: TaskInput & { name: string }) { if (input.homeAssetId) await this.asset(userId, input.homeAssetId); return this.prisma.homeMaintenanceTask.create({ data: { userId, homeAssetId: input.homeAssetId ?? null, name: input.name, dueDate: date(input.dueDate), completedAt: date(input.completedAt), estimatedCost: input.estimatedCost ? new Decimal(input.estimatedCost) : null, actualCost: input.actualCost ? new Decimal(input.actualCost) : null, notes: input.notes ?? null } }); }
  async updateTask(userId: string, id: string, input: TaskInput) { const task = await this.prisma.homeMaintenanceTask.findFirst({ where: { id, userId } }); if (!task) throw new NotFoundException('Home maintenance task not found'); if (input.homeAssetId) await this.asset(userId, input.homeAssetId); return this.prisma.homeMaintenanceTask.update({ where: { id }, data: { ...(input.homeAssetId !== undefined ? { homeAssetId: input.homeAssetId } : {}), ...(input.name !== undefined ? { name: input.name } : {}), ...(input.dueDate !== undefined ? { dueDate: date(input.dueDate) } : {}), ...(input.completedAt !== undefined ? { completedAt: date(input.completedAt) } : {}), ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost ? new Decimal(input.estimatedCost) : null } : {}), ...(input.actualCost !== undefined ? { actualCost: input.actualCost ? new Decimal(input.actualCost) : null } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) } }); }
  async removeTask(userId: string, id: string) { const task = await this.prisma.homeMaintenanceTask.findFirst({ where: { id, userId } }); if (!task) throw new NotFoundException('Home maintenance task not found'); await this.prisma.homeMaintenanceTask.delete({ where: { id } }); }
  private async asset(userId: string, id: string) { const asset = await this.prisma.homeAsset.findFirst({ where: { id, userId } }); if (!asset) throw new NotFoundException('Home asset not found'); return asset; }
}
