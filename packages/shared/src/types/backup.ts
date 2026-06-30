/**
 * Backup domain types.
 */

/** Backup scheduling frequency. */
export enum BackupSchedule {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/** Backup entity matching Prisma schema. */
export interface Backup {
  id: string;
  userId: string;
  filename: string;
  /** Size in bytes (stored as bigint in DB, string for serialization). */
  size: string;
  createdAt: Date;
}
