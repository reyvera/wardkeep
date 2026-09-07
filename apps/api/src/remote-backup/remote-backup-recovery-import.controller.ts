import { BadRequestException, Body, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RemoteBackupRecoveryImportService } from './remote-backup-recovery-import.service';

const importSchema = z.object({
  peerUrl: z.string().trim().min(1).max(2048),
  offerId: z.string().uuid(),
  secret: z.string().min(32).max(200),
  passphrase: z.string().min(12).max(256),
});

@Controller('remote-backup/recovery')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RemoteBackupRecoveryImportController {
  constructor(private readonly recovery: RemoteBackupRecoveryImportService) {}

  @Post('import')
  import(@Req() request: ScopedRequest, @Body() body: unknown) {
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.recovery.importPortableArchive({ userId: request.userId!, ...parsed.data });
  }
}
