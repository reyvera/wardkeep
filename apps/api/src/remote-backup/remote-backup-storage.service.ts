import { BadRequestException, Injectable } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_REMOTE_BACKUP_MAX_BYTES = 1024 * 1024 * 1024;
const DEFAULT_REMOTE_BACKUPS_PER_PEER = 10;

function remoteBackupDirectory(): string {
  return process.env['WARDKEEP_REMOTE_BACKUP_DIR'] ?? '/data/remote-backups';
}

function remoteBackupMaxBytes(): number {
  const configured = Number(process.env['WARDKEEP_REMOTE_BACKUP_MAX_BYTES']);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_REMOTE_BACKUP_MAX_BYTES;
}

@Injectable()
export class RemoteBackupStorageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an already-authenticated opaque encrypted blob. This service never
   * decrypts or parses the body; callers must authenticate it before calling.
   */
  async receive(
    input: {
      peerId: string;
      userId: string;
      sourceBackupId: string;
      recoveryClass: RemoteBackupRecoveryClass;
      createdAt: Date;
      expectedSize: number;
      expectedChecksum: string;
      chunks: AsyncIterable<Uint8Array>;
    },
    receivedAt = new Date(),
  ) {
    if (
      !Number.isSafeInteger(input.expectedSize) ||
      input.expectedSize < 0 ||
      input.expectedSize > remoteBackupMaxBytes() ||
      !/^[a-f0-9]{64}$/i.test(input.expectedChecksum)
    ) {
      throw new BadRequestException('Remote backup metadata is invalid');
    }

    const id = randomUUID();
    const directory = join(remoteBackupDirectory(), input.peerId);
    const filename = `${id}.enc`;
    const finalPath = join(directory, filename);
    const temporaryPath = `${finalPath}.part`;
    await mkdir(directory, { recursive: true });
    const file = await open(temporaryPath, 'wx', 0o600);
    const digest = createHash('sha256');
    let size = 0;

    try {
      for await (const chunk of input.chunks) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > input.expectedSize || size > remoteBackupMaxBytes()) {
          throw new BadRequestException('Remote backup exceeds its declared size limit');
        }
        digest.update(buffer);
        await file.write(buffer);
      }
      await file.close();

      const checksum = digest.digest('hex');
      if (
        size !== input.expectedSize ||
        !safeEqual(checksum, input.expectedChecksum.toLowerCase())
      ) {
        throw new BadRequestException('Remote backup content does not match its declared digest');
      }

      const backup = await this.prisma.remoteBackup.create({
        data: {
          id,
          peerId: input.peerId,
          userId: input.userId,
          sourceBackupId: input.sourceBackupId,
          recoveryClass: input.recoveryClass,
          filename,
          size: BigInt(size),
          checksum,
          createdAt: input.createdAt,
          receivedAt,
        },
      });
      try {
        await rename(temporaryPath, finalPath);
      } catch (error) {
        await this.prisma.remoteBackup.delete({ where: { id } }).catch(() => undefined);
        throw error;
      }

      await this.enforceRetention(input.peerId);
      return {
        id: backup.id,
        size,
        checksum,
        createdAt: backup.createdAt,
        receivedAt: backup.receivedAt,
      };
    } catch (error) {
      await file.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async enforceRetention(peerId: string): Promise<void> {
    const backups = await this.prisma.remoteBackup.findMany({
      where: { peerId },
      orderBy: { receivedAt: 'desc' },
      select: { id: true, filename: true },
    });
    const expired = backups.slice(DEFAULT_REMOTE_BACKUPS_PER_PEER);
    if (expired.length === 0) return;

    await this.prisma.remoteBackup.deleteMany({
      where: { id: { in: expired.map((backup) => backup.id) } },
    });
    await Promise.all(
      expired.map((backup) =>
        unlink(join(remoteBackupDirectory(), peerId, backup.filename)).catch(() => undefined),
      ),
    );
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf-8');
  const rightBuffer = Buffer.from(right, 'utf-8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
