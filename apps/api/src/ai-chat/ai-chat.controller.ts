import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { AiChatService } from './ai-chat.service';
import { ChatRequestSchema } from './dto/chat.dto';

@Controller('chat')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * Sends a chat message and receives an AI-generated response.
   * Creates a new session if no sessionId is provided.
   * @param req - The scoped request with userId and body containing query and optional sessionId
   * @returns AI response with verified data and session info
   */
  @Post()
  async chat(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = ChatRequestSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.aiChatService.chat(userId, result.data);
  }

  /**
   * Retrieves chat message history for a session.
   * @param req - The scoped request with userId
   * @param sessionId - The session ID query parameter
   * @returns Array of chat messages in chronological order
   */
  @Get('history')
  async getHistory(
    @Req() req: ScopedRequest,
    @Query('sessionId') sessionId?: string,
  ) {
    const userId = req.userId!;

    if (!sessionId) {
      throw new BadRequestException('sessionId query parameter is required');
    }

    return this.aiChatService.getHistory(userId, sessionId);
  }
}
