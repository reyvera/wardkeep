import { Injectable } from '@nestjs/common';

import { AiChatService } from '../ai-chat/ai-chat.service';
import { ChatRequestDto } from '../ai-chat/dto/chat.dto';

/**
 * Advisor-facing conversation boundary. It delegates model execution to the
 * existing provider layer and never writes or recalculates readiness scores.
 */
@Injectable()
export class AdvisorConversationService {
  constructor(private readonly conversation: AiChatService) {}

  respond(userId: string, request: ChatRequestDto) {
    return this.conversation.chat(userId, request);
  }

  history(userId: string, sessionId: string) {
    return this.conversation.getHistory(userId, sessionId);
  }
}
