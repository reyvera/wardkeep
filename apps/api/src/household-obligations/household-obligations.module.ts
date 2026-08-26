import { Module } from '@nestjs/common';

import { HouseholdObligationsController } from './household-obligations.controller';
import { HouseholdObligationsService } from './household-obligations.service';

@Module({
  controllers: [HouseholdObligationsController],
  providers: [HouseholdObligationsService],
})
export class HouseholdObligationsModule {}
