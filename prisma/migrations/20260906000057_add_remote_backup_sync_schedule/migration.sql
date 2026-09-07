CREATE TYPE "RemoteBackupSyncSchedule" AS ENUM ('HOURLY', 'EVERY_6H', 'DAILY', 'WEEKLY');

ALTER TABLE "RemoteBackupPeer"
  ADD COLUMN "syncSchedule" "RemoteBackupSyncSchedule";

CREATE INDEX "RemoteBackupPeer_status_syncSchedule_idx"
  ON "RemoteBackupPeer"("status", "syncSchedule");
