import { Module } from '@nestjs/common';

import { BankConnectionsController } from './bank-connections.controller';
import { BankConnectionsService } from './bank-connections.service';

@Module({
  controllers: [BankConnectionsController],
  providers: [BankConnectionsService],
  exports: [BankConnectionsService],
})
export class BankConnectionsModule {}
