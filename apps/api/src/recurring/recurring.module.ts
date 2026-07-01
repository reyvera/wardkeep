import { Module } from '@nestjs/common';

import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

@Module({
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
