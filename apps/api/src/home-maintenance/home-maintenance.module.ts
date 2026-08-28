import { Module } from '@nestjs/common';
import { HomeMaintenanceController } from './home-maintenance.controller';
import { HomeMaintenanceService } from './home-maintenance.service';
@Module({ controllers: [HomeMaintenanceController], providers: [HomeMaintenanceService] }) export class HomeMaintenanceModule {}
