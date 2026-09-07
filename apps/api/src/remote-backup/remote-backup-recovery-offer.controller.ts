import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RemoteBackupRecoveryOfferService } from './remote-backup-recovery-offer.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';

@Controller('remote-backup/recovery-offers')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RemoteBackupRecoveryOfferController {
  constructor(private readonly offers: RemoteBackupRecoveryOfferService) {}

  /** Creates an archive-scoped secret shown only once to the receiver owner. */
  @Post(':remoteBackupId')
  create(@Req() request: ScopedRequest, @Param('remoteBackupId') remoteBackupId: string) {
    if (!z.string().uuid().safeParse(remoteBackupId).success) {
      throw new BadRequestException('remoteBackupId must be a valid UUID');
    }
    return this.offers.create(request.userId!, remoteBackupId);
  }
}

@Controller('remote-backup/recovery')
export class RemoteBackupRecoveryRedemptionController {
  constructor(
    private readonly offers: RemoteBackupRecoveryOfferService,
    private readonly storage: RemoteBackupStorageService,
  ) {}

  @Post('redeem')
  redeem(@Body() body: unknown) {
    const parsed = z
      .object({ offerId: z.string().uuid(), secret: z.string().min(32) })
      .safeParse(body);
    if (!parsed.success) throw new BadRequestException('Recovery offer is invalid');
    return this.offers.redeem(parsed.data.offerId, parsed.data.secret);
  }

  @Post('download')
  async download(@Body() body: unknown, @Res() response: Response) {
    const parsed = z.object({ sessionToken: z.string().min(32) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('Recovery session is invalid');
    const backupId = await this.offers.consumeSession(parsed.data.sessionToken);
    const archive = await this.storage.openForRecovery(backupId);
    if (!archive) throw new BadRequestException('Recovery archive is unavailable');
    response.set({
      'content-type': 'application/octet-stream',
      'content-length': String(archive.size),
      'x-wardkeep-content-sha256': archive.checksum,
    });
    archive.stream.on('error', () => response.destroy());
    archive.stream.pipe(response);
  }
}
