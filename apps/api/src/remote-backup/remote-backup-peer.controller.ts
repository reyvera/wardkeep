import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RemoteBackupPeerService } from './remote-backup-peer.service';
import { RemoteBackupTransferService } from './remote-backup-transfer.service';

@Controller('remote-backup/peers')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class RemoteBackupPeerController {
  constructor(
    private readonly peers: RemoteBackupPeerService,
    private readonly transfers: RemoteBackupTransferService,
  ) {}

  @Get()
  list(@Req() req: ScopedRequest) {
    return this.peers.list(req.userId!);
  }

  @Post(':peerId/revoke')
  revoke(@Req() req: ScopedRequest, @Param('peerId') peerId: string) {
    if (!z.string().uuid().safeParse(peerId).success) {
      throw new BadRequestException('peerId must be a valid UUID');
    }
    return this.peers.revoke(req.userId!, peerId);
  }

  @Post(':peerId/backups/:backupId/push')
  push(
    @Req() req: ScopedRequest,
    @Param('peerId') peerId: string,
    @Param('backupId') backupId: string,
  ) {
    if (
      !z.string().uuid().safeParse(peerId).success ||
      !z.string().uuid().safeParse(backupId).success
    ) {
      throw new BadRequestException('peerId and backupId must be valid UUIDs');
    }
    return this.transfers.push(req.userId!, peerId, backupId);
  }
}
