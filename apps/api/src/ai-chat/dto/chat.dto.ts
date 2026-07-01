import { z } from 'zod';

/** Schema for sending a chat message. */
export const ChatRequestSchema = z.object({
  query: z.string().min(1).max(500),
  sessionId: z.string().uuid().optional(),
});

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;
