import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
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

  @Patch(':peerId/sync-schedule')
  setSyncSchedule(@Req() req: ScopedRequest, @Param('peerId') peerId: string) {
    if (!z.string().uuid().safeParse(peerId).success) {
      throw new BadRequestException('peerId must be a valid UUID');
    }
    const parsed = z
      .object({ schedule: z.enum(['HOURLY', 'EVERY_6H', 'DAILY', 'WEEKLY']).nullable() })
      .safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.peers.setSyncSchedule(req.userId!, peerId, parsed.data.schedule);
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

  @Get(':peerId/backups')
  listBackups(@Req() req: ScopedRequest, @Param('peerId') peerId: string) {
    if (!z.string().uuid().safeParse(peerId).success) {
      throw new BadRequestException('peerId must be a valid UUID');
    }
    return this.transfers.listRemoteBackups(req.userId!, peerId);
  }

  @Post(':peerId/backups/:backupId/restore')
  restoreBackup(
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
    const parsed = z
      .object({ passphrase: z.string().min(12).max(256).optional() })
      .safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.transfers.restoreRemoteBackup(
      req.userId!,
      peerId,
      backupId,
      parsed.data.passphrase,
    );
  }
}
