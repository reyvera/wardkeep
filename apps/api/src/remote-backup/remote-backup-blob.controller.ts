import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';

import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';

const metadataSchema = z.object({
  peerId: z.string().uuid(),
  sourceBackupId: z.string().uuid(),
  recoveryClass: z.nativeEnum(RemoteBackupRecoveryClass),
  createdAt: z.string().datetime({ offset: true }),
  size: z.coerce.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  timestamp: z.string().datetime({ offset: true }),
  nonce: z.string().min(16),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  signature: z.string().min(4),
});

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

@Controller('remote-backup')
export class RemoteBackupBlobController {
  constructor(
    private readonly peerAuth: RemoteBackupPeerAuthService,
    private readonly storage: RemoteBackupStorageService,
  ) {}

  /** Accepts only an authenticated opaque binary stream; it never parses backup plaintext. */
  @Post('blobs')
  async receive(@Req() request: Request) {
    if (!header(request, 'content-type')?.startsWith('application/octet-stream')) {
      throw new BadRequestException('Remote backup uploads must use application/octet-stream');
    }
    const parsed = metadataSchema.safeParse({
      peerId: header(request, 'x-wardkeep-peer'),
      sourceBackupId: header(request, 'x-wardkeep-source-backup'),
      recoveryClass: header(request, 'x-wardkeep-recovery-class'),
      createdAt: header(request, 'x-wardkeep-created-at'),
      size: header(request, 'content-length'),
      checksum: header(request, 'x-wardkeep-content-sha256'),
      timestamp: header(request, 'x-wardkeep-timestamp'),
      nonce: header(request, 'x-wardkeep-nonce'),
      contentSha256: header(request, 'x-wardkeep-content-sha256'),
      signature: header(request, 'x-wardkeep-signature'),
    });
    if (!parsed.success) throw new BadRequestException('Remote backup upload metadata is invalid');

    const metadata = parsed.data;
    const auth = await this.peerAuth.authenticateHeaders({
      peerId: metadata.peerId,
      method: 'POST',
      path: '/api/remote-backup/blobs',
      headers: {
        'x-wardkeep-timestamp': metadata.timestamp,
        'x-wardkeep-nonce': metadata.nonce,
        'x-wardkeep-content-sha256': metadata.contentSha256,
        'x-wardkeep-signature': metadata.signature,
      },
    });
    return this.storage.receive({
      peerId: auth.peerId,
      userId: auth.userId,
      sourceBackupId: metadata.sourceBackupId,
      recoveryClass: metadata.recoveryClass,
      createdAt: new Date(metadata.createdAt),
      expectedSize: metadata.size,
      expectedChecksum: metadata.checksum,
      chunks: request as unknown as AsyncIterable<Uint8Array>,
    });
  }
}
