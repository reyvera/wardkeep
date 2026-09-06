import { Module } from '@nestjs/common';

import { RemoteBackupPairingController } from './remote-backup-pairing.controller';
import { RemoteBackupBlobController } from './remote-backup-blob.controller';
import { RemoteBackupNonceService } from './remote-backup-nonce.service';
import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';
import { RemoteBackupPairingService } from './remote-backup-pairing.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';

@Module({
  controllers: [RemoteBackupBlobController, RemoteBackupPairingController],
  providers: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPairingService,
    RemoteBackupStorageService,
  ],
  exports: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPairingService,
    RemoteBackupStorageService,
  ],
})
export class RemoteBackupModule {}
