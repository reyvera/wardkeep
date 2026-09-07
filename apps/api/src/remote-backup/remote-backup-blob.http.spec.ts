import { Test } from '@nestjs/testing';
import { RemoteBackupPeerDirection, RemoteBackupRecoveryClass } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RemoteBackupBlobController } from './remote-backup-blob.controller';
import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';

describe('remote backup blob HTTP contract', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => close?.());

  it('uploads, lists, and downloads an opaque archive through the authenticated routes', async () => {
    const peerId = randomUUID();
    const sourceBackupId = randomUUID();
    const body = Buffer.from('opaque encrypted archive');
    const checksum = createHash('sha256').update(body).digest('hex');
    const records = new Map<string, { body: Buffer; checksum: string }>();
    const storage = {
      receive: vi.fn(async (input: { sourceBackupId: string; chunks: AsyncIterable<Uint8Array>; expectedChecksum: string }) => {
        const chunks: Buffer[] = [];
        for await (const chunk of input.chunks) chunks.push(Buffer.from(chunk));
        const received = Buffer.concat(chunks);
        const id = randomUUID();
        records.set(id, { body: received, checksum: input.expectedChecksum });
        return { id, size: received.length, checksum: input.expectedChecksum };
      }),
      list: vi.fn(() => [...records].map(([id, record]) => ({
        id, sourceBackupId, recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
        size: record.body.length, checksum: record.checksum,
        createdAt: new Date(), receivedAt: new Date(),
      }))),
      open: vi.fn((_peerId: string, backupId: string) => {
        const record = records.get(backupId);
        return record && { stream: Readable.from(record.body), size: record.body.length, checksum: record.checksum };
      }),
    };
    const peerAuth = {
      authenticateHeaders: vi.fn().mockResolvedValue({ peerId, userId: 'household-1', direction: RemoteBackupPeerDirection.BOTH }),
    };
    const module = await Test.createTestingModule({
      controllers: [RemoteBackupBlobController],
      providers: [
        { provide: RemoteBackupPeerAuthService, useValue: peerAuth },
        { provide: RemoteBackupStorageService, useValue: storage },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    close = () => app.close();
    const address = app.getHttpServer().address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/remote-backup`;
    const headers = {
      'x-wardkeep-peer': peerId,
      'x-wardkeep-source-backup': sourceBackupId,
      'x-wardkeep-recovery-class': RemoteBackupRecoveryClass.PORTABLE_MANUAL,
      'x-wardkeep-created-at': new Date().toISOString(),
      'x-wardkeep-timestamp': new Date().toISOString(),
      'x-wardkeep-nonce': 'n'.repeat(16),
      'x-wardkeep-content-sha256': checksum,
      'x-wardkeep-signature': 'v1=test',
    };
    const upload = await fetch(`${baseUrl}/blobs`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/octet-stream' }, body,
    });
    expect(upload.status).toBe(201);
    const uploaded = await upload.json() as { id: string };
    const peerHeaders = {
      'x-wardkeep-peer': peerId,
      'x-wardkeep-timestamp': new Date().toISOString(),
      'x-wardkeep-nonce': 'm'.repeat(16),
      'x-wardkeep-content-sha256': createHash('sha256').digest('hex'),
      'x-wardkeep-signature': 'v1=test',
    };
    const listed = await fetch(`${baseUrl}/blobs`, { headers: peerHeaders });
    expect(listed.status).toBe(200);
    expect((await listed.json()) as Array<{ id: string }>).toEqual([expect.objectContaining({ id: uploaded.id })]);
    const downloaded = await fetch(`${baseUrl}/blobs/${uploaded.id}`, { headers: peerHeaders });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('x-wardkeep-content-sha256')).toBe(checksum);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(body);
  });
});
