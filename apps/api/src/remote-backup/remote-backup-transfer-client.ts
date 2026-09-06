import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

import { RemoteBackupRecoveryClass } from '@prisma/client';

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
