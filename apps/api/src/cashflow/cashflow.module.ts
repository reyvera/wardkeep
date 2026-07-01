import { Module } from '@nestjs/common';

import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  controllers: [CashflowController],
  providers: [CashflowService],
  exports: [CashflowService],
})
export class CashflowModule {}
