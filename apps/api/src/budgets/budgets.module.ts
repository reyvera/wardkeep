import { Module } from '@nestjs/common';

import { ReadinessModule } from '../readiness/readiness.module';

import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [ReadinessModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
