import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { VehiclesService } from './vehicles.service';

const optionalDate = z.string().date().nullable().optional();
const optionalAmount = z.string().regex(/^\d+(\.\d+)?$/).nullable().optional();
const optionalInteger = z.number().int().nonnegative().nullable().optional();
const vehicleSchema = z.object({
  kind: z.enum(['AUTOMOBILE', 'MOTORCYCLE', 'RV', 'BOAT', 'TRAILER', 'ATV', 'OTHER']).optional(),
  ownership: z.enum(['OWNED', 'FINANCED', 'LEASED', 'OTHER']).optional(),
  nickname: z.string().trim().min(1).max(100).nullable().optional(),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(9999).nullable().optional(),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable().optional(),
  mileage: optionalInteger,
  loanBalance: optionalAmount,
  leasePayment: optionalAmount,
  leaseEndDate: optionalDate,
  leaseMileageAllowance: optionalInteger,
  estimatedValue: optionalAmount,
  valuationSource: z.string().trim().min(1).max(80).nullable().optional(),
  valuedAt: optionalDate,
  notes: z.string().trim().max(1000).nullable().optional(),
});
const maintenanceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dueDate: optionalDate,
  dueMileage: optionalInteger,
  completedAt: optionalDate,
  completedMileage: optionalInteger,
  estimatedCost: optionalAmount,
  notes: z.string().trim().max(1000).nullable().optional(),
});

@Controller('vehicles')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@Req() req: ScopedRequest) { return this.vehicles.list(req.userId!); }

  @Post()
  create(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.vehicles.create(req.userId!, parsed.data);
  }

  @Patch(':id')
  update(@Req() req: ScopedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = vehicleSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.vehicles.update(req.userId!, id, parsed.data);
  }

  @Delete(':id')
  remove(@Req() req: ScopedRequest, @Param('id') id: string) { return this.vehicles.remove(req.userId!, id); }

  @Post(':vehicleId/maintenance')
  addMaintenance(@Req() req: ScopedRequest, @Param('vehicleId') vehicleId: string, @Body() body: unknown) {
    const parsed = maintenanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.vehicles.addMaintenance(req.userId!, vehicleId, parsed.data);
  }

  @Patch(':vehicleId/maintenance/:id')
  updateMaintenance(@Req() req: ScopedRequest, @Param('vehicleId') vehicleId: string, @Param('id') id: string, @Body() body: unknown) {
    const parsed = maintenanceSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.vehicles.updateMaintenance(req.userId!, vehicleId, id, parsed.data);
  }

  @Delete(':vehicleId/maintenance/:id')
  removeMaintenance(@Req() req: ScopedRequest, @Param('vehicleId') vehicleId: string, @Param('id') id: string) {
    return this.vehicles.removeMaintenance(req.userId!, vehicleId, id);
  }
}
