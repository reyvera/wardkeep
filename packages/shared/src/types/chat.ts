/**
 * Chat/AI session domain types.
 */

/** Chat session entity matching Prisma schema. */
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date;
  messages?: ChatMessage[];
}

/** Individual message within a chat session. */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  verifiedData: unknown;
  createdAt: Date;
}
