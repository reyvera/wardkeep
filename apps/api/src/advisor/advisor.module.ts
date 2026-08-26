import { Module } from '@nestjs/common';

import { ReadinessModule } from '../readiness/readiness.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [ReadinessModule, RecommendationsModule, TimelineModule],
  controllers: [AdvisorController],
  providers: [AdvisorService],
})
export class AdvisorModule {}
