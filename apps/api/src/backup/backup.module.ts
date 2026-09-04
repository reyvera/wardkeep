import { Module } from '@nestjs/common';

import { BackupController } from './backup.controller';
import { BackupInternalController } from './backup-internal.controller';
import { BackupService } from './backup.service';

@Module({
  controllers: [BackupController, BackupInternalController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
