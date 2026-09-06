import { Module } from '@nestjs/common';

import { RemoteBackupPairingController } from './remote-backup-pairing.controller';
import { RemoteBackupBlobController } from './remote-backup-blob.controller';
import { RemoteBackupPeerController } from './remote-backup-peer.controller';
import { RemoteBackupNonceService } from './remote-backup-nonce.service';
import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';
import { RemoteBackupPeerService } from './remote-backup-peer.service';
import { RemoteBackupPairingService } from './remote-backup-pairing.service';
import { RemoteBackupOutboundPairingService } from './remote-backup-outbound-pairing.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';
import { RemoteBackupTransferService } from './remote-backup-transfer.service';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [BackupModule],
  controllers: [
    RemoteBackupBlobController,
    RemoteBackupPairingController,
    RemoteBackupPeerController,
  ],
  providers: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPeerService,
    RemoteBackupPairingService,
    RemoteBackupOutboundPairingService,
    RemoteBackupStorageService,
    RemoteBackupTransferService,
  ],
  exports: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPeerService,
    RemoteBackupPairingService,
    RemoteBackupOutboundPairingService,
    RemoteBackupStorageService,
    RemoteBackupTransferService,
  ],
})
export class RemoteBackupModule {}
