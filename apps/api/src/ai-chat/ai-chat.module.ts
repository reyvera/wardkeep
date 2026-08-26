import { Module } from '@nestjs/common';

import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { ReadinessModule } from '../readiness/readiness.module';

@Module({
  imports: [ReadinessModule],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
