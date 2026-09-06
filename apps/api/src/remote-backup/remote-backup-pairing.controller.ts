import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RemoteBackupPeerDirection } from '@prisma/client';
import { z } from 'zod';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { RemoteBackupPairingService } from './remote-backup-pairing.service';
import {
  resolveRemoteBackupPeerAddresses,
  validateRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

const createOfferSchema = z.object({
  direction: z.nativeEnum(RemoteBackupPeerDirection).default(RemoteBackupPeerDirection.BOTH),
  peerName: z.string().trim().min(1).max(120).optional(),
});
const redeemOfferSchema = z.object({
  offerId: z.string().uuid(),
  secret: z.string().min(43).max(200),
  remotePeerId: z.string().uuid(),
  peerUrl: z.string().trim().min(1).max(2048),
  peerName: z.string().trim().min(1).max(120),
  direction: z.nativeEnum(RemoteBackupPeerDirection),
});

@Controller('remote-backup/pair')
export class RemoteBackupPairingController {
  constructor(private readonly pairingService: RemoteBackupPairingService) {}

  @Post('offers')
  @UseGuards(AuthGuard)
  @UseInterceptors(UserScopeInterceptor)
  createOffer(@Req() req: ScopedRequest, @Body() body: unknown) {
    const parsed = createOfferSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.pairingService.createOffer(req.userId!, parsed.data);
  }

  @Post('offers/:offerId/revoke')
  @UseGuards(AuthGuard)
  @UseInterceptors(UserScopeInterceptor)
  revokeOffer(@Req() req: ScopedRequest, @Param('offerId') offerId: string) {
    if (!z.string().uuid().safeParse(offerId).success) {
      throw new BadRequestException('offerId must be a valid UUID');
    }
    return this.pairingService.revokeOffer(req.userId!, offerId);
  }

  /** Secret-gated receiver endpoint. It intentionally has no browser session guard. */
  @Post('redeem')
  async redeemOffer(@Body() body: unknown) {
    const parsed = redeemOfferSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);

    let peerUrl: URL;
    try {
      peerUrl = await validateRemoteBackupPeerUrl(
        parsed.data.peerUrl,
        resolveRemoteBackupPeerAddresses,
      );
    } catch {
      throw new BadRequestException('Remote backup peer URL is unavailable or unsafe');
    }

    return this.pairingService.redeemOffer({ ...parsed.data, peerUrl: peerUrl.origin });
  }
}
