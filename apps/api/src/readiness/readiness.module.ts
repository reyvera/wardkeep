import { Module } from '@nestjs/common';

import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';

@Module({
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
