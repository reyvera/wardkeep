import { z } from 'zod';

/**
 * Zod schema for updating user settings.
 * All fields are optional — only provided fields will be updated.
 */
export const UpdateSettingsSchema = z.object({
  aiPrivacyMode: z.enum(['LOCAL', 'HYBRID', 'CLOUD']).optional(),
  openaiKey: z.string().optional().nullable(),
  anthropicKey: z.string().optional().nullable(),
  backupSchedule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable().optional(),
  backupRetention: z.number().int().min(1).max(30).optional(),
  sessionTimeout: z.number().int().min(5).max(480).optional(),
});

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;

/**
 * Zod schema for validating an API key format.
 */
export const ValidateApiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string().min(1),
});

export type ValidateApiKeyDto = z.infer<typeof ValidateApiKeySchema>;
