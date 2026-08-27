import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type VehicleInput = {
  nickname?: string | null;
  make?: string;
  model?: string;
  year?: number | null;
  mileage?: number | null;
  isActive?: boolean;
  notes?: string | null;
};

type MaintenanceInput = {
  name?: string;
  dueDate?: string | null;
  dueMileage?: number | null;
  completedAt?: string | null;
  completedMileage?: number | null;
  estimatedCost?: string | null;
  notes?: string | null;
};

const date = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId },
      include: { maintenance: { orderBy: [{ completedAt: 'asc' }, { dueDate: 'asc' }] } },
      orderBy: [{ isActive: 'desc' }, { make: 'asc' }, { model: 'asc' }],
    });
  }

  create(userId: string, input: VehicleInput & { make: string; model: string }) {
    return this.prisma.vehicle.create({
      data: {
        userId,
        make: input.make,
        model: input.model,
        nickname: input.nickname ?? null,
        year: input.year ?? null,
        mileage: input.mileage ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: VehicleInput) {
    await this.vehicleForUser(userId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.make !== undefined ? { make: input.make } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.mileage !== undefined ? { mileage: input.mileage } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.vehicleForUser(userId, id);
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async addMaintenance(userId: string, vehicleId: string, input: MaintenanceInput & { name: string }) {
    await this.vehicleForUser(userId, vehicleId);
    return this.prisma.vehicleMaintenance.create({
      data: {
        vehicleId,
        name: input.name,
        dueDate: date(input.dueDate),
        dueMileage: input.dueMileage ?? null,
        completedAt: date(input.completedAt),
        completedMileage: input.completedMileage ?? null,
        estimatedCost: input.estimatedCost ? new Decimal(input.estimatedCost) : null,
        notes: input.notes ?? null,
      },
    });
  }

  async updateMaintenance(userId: string, vehicleId: string, id: string, input: MaintenanceInput) {
    await this.vehicleForUser(userId, vehicleId);
    const maintenance = await this.prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId } });
    if (!maintenance) throw new NotFoundException('Vehicle maintenance record not found');
    return this.prisma.vehicleMaintenance.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.dueDate !== undefined ? { dueDate: date(input.dueDate) } : {}),
        ...(input.dueMileage !== undefined ? { dueMileage: input.dueMileage } : {}),
        ...(input.completedAt !== undefined ? { completedAt: date(input.completedAt) } : {}),
        ...(input.completedMileage !== undefined ? { completedMileage: input.completedMileage } : {}),
        ...(input.estimatedCost !== undefined
          ? { estimatedCost: input.estimatedCost ? new Decimal(input.estimatedCost) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async removeMaintenance(userId: string, vehicleId: string, id: string) {
    await this.vehicleForUser(userId, vehicleId);
    const maintenance = await this.prisma.vehicleMaintenance.findFirst({ where: { id, vehicleId } });
    if (!maintenance) throw new NotFoundException('Vehicle maintenance record not found');
    await this.prisma.vehicleMaintenance.delete({ where: { id } });
  }

  private async vehicleForUser(userId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, userId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
}
