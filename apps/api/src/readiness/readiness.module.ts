import { Module } from '@nestjs/common';

import { ReadinessController } from './readiness.controller';
import { ReadinessInternalController } from './readiness-internal.controller';
import { ReadinessService } from './readiness.service';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [RecommendationsModule, CapabilitiesModule],
  controllers: [ReadinessController, ReadinessInternalController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
