import { z } from 'zod';

/**
 * Zod schema for creating an encrypted backup.
 * Requires a passphrase of at least 12 characters for AES-256-GCM encryption.
 */
export const CreateBackupSchema = z.object({
  passphrase: z.string().min(12, 'Passphrase must be at least 12 characters'),
});

export type CreateBackupDto = z.infer<typeof CreateBackupSchema>;
