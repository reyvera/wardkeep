import { Module } from '@nestjs/common';

import { CapabilitiesController } from './capabilities.controller';
import { CapabilitiesService } from './capabilities.service';
import { FinanceCapability } from './finance.capability';

@Module({ controllers: [CapabilitiesController], providers: [CapabilitiesService, FinanceCapability], exports: [CapabilitiesService] })
export class CapabilitiesModule {}
