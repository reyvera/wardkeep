import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const REMOTE_BACKUP_SIGNATURE_VERSION = 'v1';
export const REMOTE_BACKUP_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface RemoteBackupRequestParts {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  contentSha256: string;
}

export interface RemoteBackupSignedHeaders {
  'x-wardkeep-peer': string;
  'x-wardkeep-timestamp': string;
  'x-wardkeep-nonce': string;
  'x-wardkeep-content-sha256': string;
  'x-wardkeep-signature': string;
}

export function remoteBackupContentSha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function remoteBackupSignaturePayload(parts: RemoteBackupRequestParts): string {
  return [
    REMOTE_BACKUP_SIGNATURE_VERSION,
    parts.method.toUpperCase(),
    parts.path,
    parts.timestamp,
    parts.nonce,
    parts.contentSha256,
  ].join('\n');
}

export function signRemoteBackupRequest(secret: string, parts: RemoteBackupRequestParts): string {
  return createHmac('sha256', secret)
    .update(remoteBackupSignaturePayload(parts))
    .digest('base64url');
}

export function createRemoteBackupSignedHeaders({
  peerId,
  secret,
  method,
  path,
  body,
  timestamp = new Date().toISOString(),
  nonce = randomBytes(16).toString('base64url'),
}: {
  peerId: string;
  secret: string;
  method: string;
  path: string;
  body: Buffer;
  timestamp?: string;
  nonce?: string;
}): RemoteBackupSignedHeaders {
  const contentSha256 = remoteBackupContentSha256(body);
  const signature = signRemoteBackupRequest(secret, {
    method,
    path,
    timestamp,
    nonce,
    contentSha256,
  });

  return {
    'x-wardkeep-peer': peerId,
    'x-wardkeep-timestamp': timestamp,
    'x-wardkeep-nonce': nonce,
    'x-wardkeep-content-sha256': contentSha256,
    'x-wardkeep-signature': `${REMOTE_BACKUP_SIGNATURE_VERSION}=${signature}`,
  };
}

export function isRemoteBackupTimestampFresh(
  timestamp: string,
  now = new Date(),
  clockSkewMs = REMOTE_BACKUP_CLOCK_SKEW_MS,
): boolean {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp) return false;
  return Math.abs(now.getTime() - parsed.getTime()) <= clockSkewMs;
}

export function verifyRemoteBackupRequest({
  secret,
  method,
  path,
  body,
  headers,
  now = new Date(),
}: {
  secret: string;
  method: string;
  path: string;
  body: Buffer;
  headers: Pick<
    RemoteBackupSignedHeaders,
    | 'x-wardkeep-timestamp'
    | 'x-wardkeep-nonce'
    | 'x-wardkeep-content-sha256'
    | 'x-wardkeep-signature'
  >;
  now?: Date;
}): boolean {
  const signaturePrefix = `${REMOTE_BACKUP_SIGNATURE_VERSION}=`;
  if (
    !headers['x-wardkeep-signature'].startsWith(signaturePrefix) ||
    !isRemoteBackupTimestampFresh(headers['x-wardkeep-timestamp'], now) ||
    headers['x-wardkeep-nonce'].length < 16
  ) {
    return false;
  }

  const contentSha256 = remoteBackupContentSha256(body);
  if (!safeEqual(contentSha256, headers['x-wardkeep-content-sha256'])) return false;

  const expected = signRemoteBackupRequest(secret, {
    method,
    path,
    timestamp: headers['x-wardkeep-timestamp'],
    nonce: headers['x-wardkeep-nonce'],
    contentSha256,
  });
  return safeEqual(expected, headers['x-wardkeep-signature'].slice(signaturePrefix.length));
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf-8');
  const rightBuffer = Buffer.from(right, 'utf-8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
