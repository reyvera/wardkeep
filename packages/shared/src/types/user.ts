/**
 * User, session, and settings domain types.
 */
import { BackupSchedule } from './backup';

/** AI privacy mode determines where AI requests are processed. */
export enum AIPrivacyMode {
  LOCAL = 'LOCAL',
  HYBRID = 'HYBRID',
  CLOUD = 'CLOUD',
}

/** User entity matching Prisma schema. */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  failedLogins: number;
  lockedUntil: Date | null;
}

/** Session entity matching Prisma schema. */
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  lastActive: Date;
}

/** User settings entity matching Prisma schema. */
export interface UserSettings {
  id: string;
  userId: string;
  aiPrivacyMode: AIPrivacyMode;
  openaiKey: string | null;
  anthropicKey: string | null;
  backupSchedule: BackupSchedule | null;
  backupPassphrase: string | null;
  backupRetention: number;
  sessionTimeout: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Audit log entry. */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: unknown;
  ip: string | null;
  createdAt: Date;
}
