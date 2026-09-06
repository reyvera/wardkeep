import { describe, expect, it } from 'vitest';

import {
  createRemoteBackupSignedHeaders,
  isRemoteBackupTimestampFresh,
  verifyRemoteBackupRequest,
} from './remote-backup-auth';

describe('remote backup request authentication', () => {
  const secret = 'remote-peer-shared-secret';
  const timestamp = '2026-09-05T00:00:00.000Z';
  const body = Buffer.from('opaque encrypted backup bytes');
  const request = {
    method: 'POST',
    path: '/api/remote-backup/blobs',
    body,
  };

  it('accepts the exact signed method, path, body, and fresh timestamp', () => {
    const headers = createRemoteBackupSignedHeaders({
      peerId: 'remote-peer-1',
      secret,
      ...request,
      timestamp,
      nonce: 'a-remote-backup-nonce',
    });

    expect(
      verifyRemoteBackupRequest({
        secret,
        ...request,
        headers,
        now: new Date('2026-09-05T00:04:59.999Z'),
      }),
    ).toBe(true);
  });

  it('rejects a modified method, path, body, secret, or stale timestamp', () => {
    const headers = createRemoteBackupSignedHeaders({
      peerId: 'remote-peer-1',
      secret,
      ...request,
      timestamp,
      nonce: 'a-remote-backup-nonce',
    });

    expect(
      verifyRemoteBackupRequest({
        secret,
        ...request,
        method: 'GET',
        headers,
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyRemoteBackupRequest({
        secret,
        ...request,
        path: '/api/remote-backup/blobs/x',
        headers,
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyRemoteBackupRequest({
        secret,
        ...request,
        body: Buffer.from('modified'),
        headers,
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyRemoteBackupRequest({
        secret: 'different-secret',
        ...request,
        headers,
        now: new Date(timestamp),
      }),
    ).toBe(false);
    expect(
      verifyRemoteBackupRequest({
        secret,
        ...request,
        headers,
        now: new Date('2026-09-05T00:05:00.001Z'),
      }),
    ).toBe(false);
  });

  it('requires a canonical ISO timestamp and a nonce with sufficient entropy', () => {
    expect(isRemoteBackupTimestampFresh('2026-09-05T00:00:00Z', new Date(timestamp))).toBe(false);

    const headers = createRemoteBackupSignedHeaders({
      peerId: 'remote-peer-1',
      secret,
      ...request,
      timestamp,
      nonce: 'short',
    });
    expect(
      verifyRemoteBackupRequest({ secret, ...request, headers, now: new Date(timestamp) }),
    ).toBe(false);
  });
});
