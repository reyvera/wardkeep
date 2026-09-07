import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { z } from 'zod';

import {
  resolveRemoteBackupPeerAddresses,
  resolveRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

const recoveryRedemptionSchema = z.object({
  remoteBackupId: z.string().uuid(),
  size: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i).transform((value) => value.toLowerCase()),
  sessionToken: z.string().min(32),
});

async function postJson(peerUrl: string, path: string, payload: Record<string, string>) {
  const destination = await resolveRemoteBackupPeerUrl(peerUrl, resolveRemoteBackupPeerAddresses);
  const body = Buffer.from(JSON.stringify(payload));
  return new Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>(
    (resolve, reject) => {
      const client = request(
        {
          protocol: 'https:',
          hostname: destination.address,
          port: destination.url.port ? Number(destination.url.port) : 443,
          path,
          method: 'POST',
          servername: isIP(destination.url.hostname) ? undefined : destination.url.hostname,
          headers: {
            host: destination.url.host,
            'content-type': 'application/json',
            'content-length': body.length,
          },
          timeout: 60_000,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let received = 0;
          response.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > 64 * 1024) response.destroy(new Error('Recovery response is too large'));
            else chunks.push(Buffer.from(chunk));
          });
          response.on('error', reject);
          response.on('end', () =>
            resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
          );
        },
      );
      client.on('timeout', () => client.destroy(new Error('Recovery request timed out')));
      client.on('error', reject);
      client.end(body);
    },
  );
}

export async function redeemRemoteBackupRecoveryOffer(input: {
  peerUrl: string;
  offerId: string;
  secret: string;
}) {
  const response = await postJson(input.peerUrl, '/api/remote-backup/recovery/redeem', {
    offerId: input.offerId,
    secret: input.secret,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error('Recovery offer was rejected');
  let result: unknown;
  try {
    result = JSON.parse(response.body.toString('utf8'));
  } catch {
    throw new Error('Recovery offer response was invalid');
  }
  const parsed = recoveryRedemptionSchema.safeParse(result);
  if (!parsed.success) throw new Error('Recovery offer response was invalid');
  return parsed.data;
}

/** Downloads exactly one redeemed opaque archive and verifies its receiver-declared digest. */
export async function downloadRemoteBackupRecoveryArchive(input: {
  peerUrl: string;
  sessionToken: string;
  size: number;
  checksum: string;
  destinationPath: string;
}) {
  const destination = await resolveRemoteBackupPeerUrl(input.peerUrl, resolveRemoteBackupPeerAddresses);
  const body = Buffer.from(JSON.stringify({ sessionToken: input.sessionToken }));
  const file = await open(input.destinationPath, 'wx', 0o600);
  try {
    await new Promise<void>((resolve, reject) => {
      const client = request(
        {
          protocol: 'https:', hostname: destination.address,
          port: destination.url.port ? Number(destination.url.port) : 443,
          path: '/api/remote-backup/recovery/download', method: 'POST',
          servername: isIP(destination.url.hostname) ? undefined : destination.url.hostname,
          headers: { host: destination.url.host, 'content-type': 'application/json', 'content-length': body.length },
          timeout: 60_000,
        },
        (response) => {
          const size = Number(response.headers['content-length']);
          const checksum = response.headers['x-wardkeep-content-sha256'];
          if (response.statusCode !== 201 && (response.statusCode ?? 0) !== 200 || size !== input.size || checksum !== input.checksum) {
            response.resume(); reject(new Error('Recovery archive download was rejected')); return;
          }
          const digest = createHash('sha256'); let received = 0;
          response.on('data', async (chunk: Buffer) => {
            response.pause();
            try {
              const data = Buffer.from(chunk); received += data.length;
              if (received > input.size) throw new Error('Recovery archive exceeds its declared size');
              digest.update(data); await file.write(data); response.resume();
            } catch (error) { response.destroy(error instanceof Error ? error : new Error('Recovery archive download failed')); }
          });
          response.on('error', reject);
          response.on('end', () => {
            const checksum = digest.digest('hex');
            if (received !== input.size || checksum !== input.checksum) reject(new Error('Recovery archive digest did not match'));
            else resolve();
          });
        },
      );
      client.on('timeout', () => client.destroy(new Error('Recovery archive download timed out')));
      client.on('error', reject); client.end(body);
    });
  } finally { await file.close().catch(() => undefined); }
}
