import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { AIChat, OllamaProvider, OpenAIProvider, AnthropicProvider, ChatMessage } from '@budgetapp/ai-engine';
import type { AIProvider } from '@budgetapp/ai-engine';
import {
  verifyAIClaim,
  FinancialContext,
  NumericalClaim,
} from '@budgetapp/finance-engine';

import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { ChatRequestDto } from './dto/chat.dto';

/** Default Ollama endpoint for local AI. */
const OLLAMA_ENDPOINT = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';

@Injectable()
export class AiChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Processes a chat message, generating an AI response with financial context.
   * Creates a new session if none is provided. Verifies numerical claims
   * using the finance engine and saves messages to the database.
   * @param userId - The authenticated user's ID
   * @param dto - The chat request with query and optional sessionId
   * @returns The AI response with session info and verified data
   */
  async chat(userId: string, dto: ChatRequestDto) {
    // Resolve or create session
    let sessionId = dto.sessionId;
    if (!sessionId) {
      const session = await this.prisma.chatSession.create({
        data: { userId },
      });
      sessionId = session.id;
    } else {
      const existing = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!existing) {
        throw new NotFoundException('Chat session not found');
      }
    }

    // Get last 10 messages from session for context
    const recentMessages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const history: ChatMessage[] = recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Build financial context from user's accounts
    const financialContext = await this.buildFinancialContext(userId);

    // Resolve the AI provider based on user settings
    const provider = await this.resolveProvider(userId);
    const aiChat = new AIChat(provider);

    // Call AI chat engine
    let aiResponse;
    try {
      aiResponse = await aiChat.chat(
        dto.query,
        financialContext,
        history,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI service unavailable';
      // Return a friendly message instead of crashing
      await this.prisma.chatMessage.create({
        data: { sessionId, role: 'user', content: dto.query },
      });
      await this.prisma.chatMessage.create({
        data: { sessionId, role: 'assistant', content: `Sorry, I couldn't process your request: ${msg}` },
      });
      return {
        sessionId,
        message: `Sorry, I couldn't process your request: ${msg}`,
        verifiedData: null,
      };
    }

    // Verify numerical claims if present
    let verifiedData: Record<string, unknown> | null = null;
    const claims = aiResponse.numericalClaims ?? [];
    if (claims.length > 0) {
      verifiedData = await this.verifyClaims(userId, claims);
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: dto.query,
      },
    });

    // Save assistant response
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponse.content,
        ...(verifiedData && {
          verifiedData: JSON.parse(JSON.stringify(verifiedData)),
        }),
      },
    });

    return {
      sessionId,
      message: aiResponse.content,
      numericalClaims: aiResponse.numericalClaims,
      verifiedData,
    };
  }

  /**
   * Retrieves chat message history for a session.
   * @param userId - The authenticated user's ID
   * @param sessionId - The chat session ID
   * @returns Array of chat messages in chronological order
   * @throws NotFoundException if the session does not exist or belongs to another user
   */
  async getHistory(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      verifiedData: m.verifiedData,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Resolves the AI provider based on user's stored settings.
   * Falls back to Ollama if no cloud keys are configured.
   */
  private async resolveProvider(userId: string): Promise<AIProvider> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const mode = settings?.aiPrivacyMode ?? 'LOCAL';

    if (mode === 'CLOUD' || mode === 'HYBRID') {
      // Try OpenAI first, then Anthropic
      if (settings?.openaiKey) {
        const decryptedKey = this.encryption.decrypt(settings.openaiKey);
        return new OpenAIProvider(decryptedKey);
      }
      if (settings?.anthropicKey) {
        const decryptedKey = this.encryption.decrypt(settings.anthropicKey);
        return new AnthropicProvider(decryptedKey);
      }
    }

    // Default to Ollama (local)
    return new OllamaProvider(OLLAMA_ENDPOINT);
  }

  /**
   * Builds a financial context string from the user's accounts and recent spending.
   * @param userId - The authenticated user's ID
   * @returns A formatted string summary of the user's financial state
   */
  private async buildFinancialContext(userId: string): Promise<string> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (accounts.length === 0) {
      return 'No accounts found.';
    }

    const summaries = accounts.map((acc) => {
      const balance = acc.transactions.reduce((sum, tx) => {
        const amount = new Decimal(tx.amount.toString());
        return tx.type === 'CREDIT' ? sum.plus(amount) : sum.minus(amount);
      }, new Decimal(acc.initialBalance.toString()));

      return `${acc.name} (${acc.type}): $${balance.toFixed(2)}`;
    });

    return `Account summaries:\n${summaries.join('\n')}`;
  }

  /**
   * Verifies AI numerical claims against independently computed values.
   * @param userId - The authenticated user's ID
   * @param claims - Array of numerical claims extracted from the AI response
   * @returns Verification results for each claim
   */
  private async verifyClaims(
    userId: string,
    claims: Array<{ type: string; value: string }>,
  ): Promise<Record<string, unknown>> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      include: { transactions: true },
    });

    const context: FinancialContext = {
      accounts: accounts.map((acc) => ({
        id: acc.id,
        initialBalance: acc.initialBalance.toString(),
        type: acc.type,
        isArchived: acc.isArchived,
        transactions: acc.transactions.map((tx) => ({
          amount: tx.amount.toString(),
          type: tx.type,
          categoryId: tx.categoryId,
          date: tx.date,
        })),
      })),
    };

    const results: Record<string, unknown> = {};

    for (const claim of claims) {
      // Only verify claims that map to verifiable types
      if (claim.type === 'dollar_amount') {
        const numericValue = claim.value.replace(/[$,]/g, '');
        const numericalClaim: NumericalClaim = {
          type: 'total_spending',
          claimedValue: numericValue,
        };

        try {
          const verification = verifyAIClaim(numericalClaim, context);
          results[claim.value] = {
            isCorrect: verification.isCorrect,
            verifiedValue: verification.verifiedValue.toFixed(2),
            correctionWarning: verification.correctionWarning,
          };
        } catch {
          // Claim cannot be verified — skip
        }
      }
    }

    return results;
  }
}
