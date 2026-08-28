import { Module } from '@nestjs/common';

import { ReadinessModule } from '../readiness/readiness.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { AdvisorConversationService } from './advisor-conversation.service';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [ReadinessModule, RecommendationsModule, TimelineModule, AiChatModule],
  controllers: [AdvisorController],
  providers: [AdvisorService, AdvisorConversationService],
})
export class AdvisorModule {}
