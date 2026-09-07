import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

import { RemoteBackupRecoveryClass } from '@prisma/client';
import { z } from 'zod';

import { signRemoteBackupRequest } from './remote-backup-auth';
import {
  resolveRemoteBackupPeerAddresses,
  resolveRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export interface RemoteBackupBlobMetadata {
  id: string;
  sourceBackupId: string;
  recoveryClass: RemoteBackupRecoveryClass;
  size: number;
  checksum: string;
  createdAt: string;
  receivedAt: string;
}

const remoteBackupBlobListSchema = z.array(
  z.object({
    id: z.string().uuid(),
    sourceBackupId: z.string().uuid(),
    recoveryClass: z.nativeEnum(RemoteBackupRecoveryClass),
    size: z.number().int().nonnegative(),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .transform((value) => value.toLowerCase()),
    createdAt: z.string().datetime({ offset: true }),
    receivedAt: z.string().datetime({ offset: true }),
  }),
);

function signedHeaders(secret: string, method: string, path: string) {
  const timestamp = new Date().toISOString();
  const nonce = randomBytes(16).toString('base64url');
  const contentSha256 = createHash('sha256').digest('hex');
  return {
    timestamp,
    nonce,
    contentSha256,
    signature: signRemoteBackupRequest(secret, { method, path, timestamp, nonce, contentSha256 }),
  };
}

async function resolveDestination(peerUrl: string) {
  return resolveRemoteBackupPeerUrl(peerUrl, resolveRemoteBackupPeerAddresses);
}

function peerRequestOptions(
  destination: Awaited<ReturnType<typeof resolveDestination>>,
  peerId: string,
  path: string,
  headers: ReturnType<typeof signedHeaders>,
) {
  return {
    protocol: 'https:',
    hostname: destination.address,
    port: destination.url.port ? Number(destination.url.port) : 443,
    path,
    method: 'GET',
    servername: isIP(destination.url.hostname) ? undefined : destination.url.hostname,
    headers: {
      host: destination.url.host,
      'x-wardkeep-peer': peerId,
      'x-wardkeep-timestamp': headers.timestamp,
      'x-wardkeep-nonce': headers.nonce,
      'x-wardkeep-content-sha256': headers.contentSha256,
      'x-wardkeep-signature': `v1=${headers.signature}`,
    },
    timeout: 60_000,
  };
}

/** Lists only the caller peer's opaque archive metadata. */
export async function listRemoteBackupBlobs(input: {
  peerUrl: string;
  peerId: string;
  secret: string;
}): Promise<RemoteBackupBlobMetadata[]> {
  const destination = await resolveDestination(input.peerUrl);
  const path = '/api/remote-backup/blobs';
  const headers = signedHeaders(input.secret, 'GET', path);
  return new Promise((resolve, reject) => {
    const client = request(
      peerRequestOptions(destination, input.peerId, path, headers),
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('error', reject);
        response.on('end', () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error('Remote backup list was rejected'));
            return;
          }
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const validated = remoteBackupBlobListSchema.safeParse(parsed);
            if (!validated.success) throw new Error('invalid response');
            resolve(validated.data);
          } catch {
            reject(new Error('Remote backup list was invalid'));
          }
        });
      },
    );
    client.on('timeout', () => client.destroy(new Error('Remote backup list timed out')));
    client.on('error', reject);
    client.end();
  });
}

/** Confirms that a paired peer is reachable and accepts the shared HMAC secret. */
export async function checkRemoteBackupHealth(input: {
  peerUrl: string;
  peerId: string;
  secret: string;
}): Promise<void> {
  const destination = await resolveDestination(input.peerUrl);
  const path = '/api/remote-backup/health';
  const headers = signedHeaders(input.secret, 'GET', path);
  await new Promise<void>((resolve, reject) => {
    const client = request(
      peerRequestOptions(destination, input.peerId, path, headers),
      (response) => {
        response.resume();
        response.on('error', reject);
        response.on('end', () =>
          response.statusCode && response.statusCode >= 200 && response.statusCode < 300
            ? resolve()
            : reject(new Error('Remote backup peer health check was rejected')),
        );
      },
    );
    client.on('timeout', () => client.destroy(new Error('Remote backup health check timed out')));
    client.on('error', reject);
    client.end();
  });
}

/** Downloads one opaque archive to a new local path and verifies the peer digest before use. */
export async function downloadRemoteBackupBlob(input: {
  peerUrl: string;
  peerId: string;
  secret: string;
  backup: Pick<RemoteBackupBlobMetadata, 'id' | 'size' | 'checksum'>;
  destinationPath: string;
}) {
  const destination = await resolveDestination(input.peerUrl);
  const path = `/api/remote-backup/blobs/${input.backup.id}`;
  const headers = signedHeaders(input.secret, 'GET', path);
  const file = await open(input.destinationPath, 'wx', 0o600);
  try {
    return await new Promise<{ size: number; checksum: string }>((resolve, reject) => {
      const client = request(
        peerRequestOptions(destination, input.peerId, path, headers),
        (response) => {
          const expectedSize = Number(response.headers['content-length']);
          const expectedChecksum = response.headers['x-wardkeep-content-sha256'];
          if (
            !response.statusCode ||
            response.statusCode < 200 ||
            response.statusCode >= 300 ||
            expectedSize !== input.backup.size ||
            expectedChecksum !== input.backup.checksum
          ) {
            response.resume();
            reject(new Error('Remote backup download was rejected'));
            return;
          }
          const digest = createHash('sha256');
          let size = 0;
          response.on('data', async (chunk: Buffer) => {
            response.pause();
            try {
              const buffer = Buffer.from(chunk);
              size += buffer.length;
              if (size > input.backup.size)
                throw new Error('Remote backup download exceeds its declared size');
              digest.update(buffer);
              await file.write(buffer);
              response.resume();
            } catch (error) {
              response.destroy(
                error instanceof Error ? error : new Error('Remote backup download failed'),
              );
            }
          });
          response.on('error', reject);
          response.on('end', () => {
            const checksum = digest.digest('hex');
            if (size !== input.backup.size || checksum !== input.backup.checksum) {
              reject(new Error('Remote backup download did not match its declared digest'));
              return;
            }
            resolve({ size, checksum });
          });
        },
      );
      client.on('timeout', () => client.destroy(new Error('Remote backup download timed out')));
      client.on('error', reject);
      client.end();
    });
  } finally {
    await file.close().catch(() => undefined);
  }
}

/** Hashes then streams an encrypted archive directly from disk to a pinned peer address. */
export async function uploadRemoteBackupBlob(input: {
  peerUrl: string;
  peerId: string;
  secret: string;
  sourceBackupId: string;
  recoveryClass: RemoteBackupRecoveryClass;
  createdAt: Date;
  path: string;
}) {
  const destination = await resolveRemoteBackupPeerUrl(
    input.peerUrl,
    resolveRemoteBackupPeerAddresses,
  );
  const file = await stat(input.path);
  if (!file.isFile()) throw new Error('Remote backup source is unavailable');
  const checksum = await fileSha256(input.path);
  const timestamp = new Date().toISOString();
  const nonce = randomBytes(16).toString('base64url');
  const signature = signRemoteBackupRequest(input.secret, {
    method: 'POST',
    path: '/api/remote-backup/blobs',
    timestamp,
    nonce,
    contentSha256: checksum,
  });

  await new Promise<void>((resolve, reject) => {
    const client = request(
      {
        protocol: 'https:',
        hostname: destination.address,
        port: destination.url.port ? Number(destination.url.port) : 443,
        path: '/api/remote-backup/blobs',
        method: 'POST',
        servername: isIP(destination.url.hostname) ? undefined : destination.url.hostname,
        headers: {
          host: destination.url.host,
          'content-type': 'application/octet-stream',
          'content-length': file.size,
          'x-wardkeep-peer': input.peerId,
          'x-wardkeep-source-backup': input.sourceBackupId,
          'x-wardkeep-recovery-class': input.recoveryClass,
          'x-wardkeep-created-at': input.createdAt.toISOString(),
          'x-wardkeep-timestamp': timestamp,
          'x-wardkeep-nonce': nonce,
          'x-wardkeep-content-sha256': checksum,
          'x-wardkeep-signature': `v1=${signature}`,
        },
        timeout: 60_000,
      },
      (response) => {
        response.resume();
        response.on('error', reject);
        response.on('end', () =>
          response.statusCode && response.statusCode >= 200 && response.statusCode < 300
            ? resolve()
            : reject(new Error('Remote backup upload was rejected')),
        );
      },
    );
    client.on('timeout', () => client.destroy(new Error('Remote backup upload timed out')));
    client.on('error', reject);
    createReadStream(input.path).on('error', reject).pipe(client);
  });
  return { size: file.size, checksum };
}
