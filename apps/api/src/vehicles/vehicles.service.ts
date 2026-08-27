import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type VehicleInput = {
  kind?: 'AUTOMOBILE' | 'MOTORCYCLE' | 'RV' | 'BOAT' | 'TRAILER' | 'ATV' | 'OTHER';
  ownership?: 'OWNED' | 'FINANCED' | 'LEASED' | 'OTHER';
  nickname?: string | null;
  make?: string;
  model?: string;
  year?: number | null;
  vin?: string | null;
  mileage?: number | null;
  loanBalance?: string | null;
  leasePayment?: string | null;
  leaseEndDate?: string | null;
  leaseMileageAllowance?: number | null;
  estimatedValue?: string | null;
  valuationSource?: string | null;
  valuedAt?: string | null;
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
  actualCost?: string | null;
  paidAt?: string | null;
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
        kind: input.kind ?? 'AUTOMOBILE',
        ownership: input.ownership ?? 'OWNED',
        make: input.make,
        model: input.model,
        nickname: input.nickname ?? null,
        year: input.year ?? null,
        vin: input.vin ?? null,
        mileage: input.mileage ?? null,
        loanBalance: input.loanBalance ? new Decimal(input.loanBalance) : null,
        leasePayment: input.leasePayment ? new Decimal(input.leasePayment) : null,
        leaseEndDate: date(input.leaseEndDate),
        leaseMileageAllowance: input.leaseMileageAllowance ?? null,
        estimatedValue: input.estimatedValue ? new Decimal(input.estimatedValue) : null,
        valuationSource: input.valuationSource ?? null,
        valuedAt: date(input.valuedAt),
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
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.ownership !== undefined ? { ownership: input.ownership } : {}),
        ...(input.make !== undefined ? { make: input.make } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.vin !== undefined ? { vin: input.vin } : {}),
        ...(input.mileage !== undefined ? { mileage: input.mileage } : {}),
        ...(input.loanBalance !== undefined ? { loanBalance: input.loanBalance ? new Decimal(input.loanBalance) : null } : {}),
        ...(input.leasePayment !== undefined ? { leasePayment: input.leasePayment ? new Decimal(input.leasePayment) : null } : {}),
        ...(input.leaseEndDate !== undefined ? { leaseEndDate: date(input.leaseEndDate) } : {}),
        ...(input.leaseMileageAllowance !== undefined ? { leaseMileageAllowance: input.leaseMileageAllowance } : {}),
        ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue ? new Decimal(input.estimatedValue) : null } : {}),
        ...(input.valuationSource !== undefined ? { valuationSource: input.valuationSource } : {}),
        ...(input.valuedAt !== undefined ? { valuedAt: date(input.valuedAt) } : {}),
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
        actualCost: input.actualCost ? new Decimal(input.actualCost) : null,
        paidAt: date(input.paidAt),
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
        ...(input.actualCost !== undefined
          ? { actualCost: input.actualCost ? new Decimal(input.actualCost) : null }
          : {}),
        ...(input.paidAt !== undefined ? { paidAt: date(input.paidAt) } : {}),
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
