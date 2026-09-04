ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "scheduledBackupLastRunAt" TIMESTAMP(3);
