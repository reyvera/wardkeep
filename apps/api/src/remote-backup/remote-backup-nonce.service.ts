import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemoteBackupNonceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns false when this peer has already used the nonce within its validity window. */
  async claim(peerId: string, nonce: string, expiresAt: Date, now = new Date()): Promise<boolean> {
    await this.prisma.remoteBackupRequestNonce.deleteMany({ where: { expiresAt: { lte: now } } });
    try {
      await this.prisma.remoteBackupRequestNonce.create({
        data: { peerId, nonceHash: hashRemoteBackupNonce(nonce), expiresAt },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}

export function hashRemoteBackupNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}
