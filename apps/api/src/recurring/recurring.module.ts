import { Module } from '@nestjs/common';

import { ReadinessModule } from '../readiness/readiness.module';

import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  imports: [ReadinessModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
