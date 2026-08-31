import { Module } from '@nestjs/common';

import { RulesModule } from '../rules/rules.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [RulesModule, ReadinessModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
