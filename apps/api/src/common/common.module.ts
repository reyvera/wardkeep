import { Global, Module } from '@nestjs/common';

import { AuditService } from './services/audit.service';
import { EncryptionService } from './services/encryption.service';

@Global()
@Module({
  providers: [AuditService, EncryptionService],
  exports: [AuditService, EncryptionService],
})
export class CommonModule {}
