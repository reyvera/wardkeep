import { z } from 'zod';

/**
 * Zod schema for restoring from an encrypted backup.
 * Requires the backup ID and the passphrase used during creation.
 */
export const RestoreBackupSchema = z.object({
  backupId: z.string().uuid('backupId must be a valid UUID'),
  passphrase: z.string().min(12, 'Passphrase must be at least 12 characters'),
});

export type RestoreBackupDto = z.infer<typeof RestoreBackupSchema>;

/**
 * Zod schema for setting the backup schedule.
 * Accepts DAILY, WEEKLY, MONTHLY, or null to disable scheduled backups.
 */
export const SetScheduleSchema = z.object({
  schedule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable(),
});

export type SetScheduleDto = z.infer<typeof SetScheduleSchema>;
