import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { EncryptionService } from '../common/services/encryption.service';
import { createRemoteBackupSignedHeaders } from './remote-backup-auth';
import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';

describe('RemoteBackupPeerAuthService', () => {
  const secret = 'paired-peer-secret';
  const now = new Date('2026-09-05T00:00:00.000Z');
  const request = {
    peerId: 'sender-peer-1',
    method: 'POST',
    path: '/api/remote-backup/blobs',
    body: Buffer.from('opaque backup bytes'),
  };

  function signedRequest() {
    return {
      ...request,
      headers: createRemoteBackupSignedHeaders({
        peerId: request.peerId,
        secret,
        method: request.method,
        path: request.path,
        body: request.body,
        timestamp: now.toISOString(),
        nonce: 'receiver-authentication-nonce',
      }),
    };
  }

  it('returns the receiving household only after signature and nonce checks pass', async () => {
    const encryption = new EncryptionService();
    const claim = vi.fn().mockResolvedValue(true);
    const service = new RemoteBackupPeerAuthService(
      {
        remoteBackupPeer: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'receiver-peer-1',
            userId: 'receiving-household-1',
            sharedSecret: encryption.encrypt(secret),
          }),
        },
      } as never,
      encryption,
      { claim } as never,
    );

    await expect(
      service.authenticateHeaders(
        {
          peerId: request.peerId,
          method: request.method,
          path: request.path,
          headers: signedRequest().headers,
        },
        now,
      ),
    ).resolves.toEqual({
      peerId: 'receiver-peer-1',
      userId: 'receiving-household-1',
    });
    expect(claim).toHaveBeenCalledWith(
      'receiver-peer-1',
      'receiver-authentication-nonce',
      new Date('2026-09-05T00:05:00.000Z'),
      now,
    );
  });

  it('rejects a bad signature before claiming a nonce', async () => {
    const encryption = new EncryptionService();
    const claim = vi.fn();
    const service = new RemoteBackupPeerAuthService(
      {
        remoteBackupPeer: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'receiver-peer-1',
            userId: 'receiving-household-1',
            sharedSecret: encryption.encrypt(secret),
          }),
        },
      } as never,
      encryption,
      { claim } as never,
    );
    const requestWithBadSignature = signedRequest();
    requestWithBadSignature.headers['x-wardkeep-signature'] = 'v1=not-valid';

    await expect(
      service.authenticateHeaders(
        {
          peerId: request.peerId,
          method: request.method,
          path: request.path,
          headers: requestWithBadSignature.headers,
        },
        now,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(claim).not.toHaveBeenCalled();
  });

  it('rejects a replayed nonce after a valid signature', async () => {
    const encryption = new EncryptionService();
    const service = new RemoteBackupPeerAuthService(
      {
        remoteBackupPeer: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'receiver-peer-1',
            userId: 'receiving-household-1',
            sharedSecret: encryption.encrypt(secret),
          }),
        },
      } as never,
      encryption,
      { claim: vi.fn().mockResolvedValue(false) } as never,
    );

    await expect(
      service.authenticateHeaders(
        {
          peerId: request.peerId,
          method: request.method,
          path: request.path,
          headers: signedRequest().headers,
        },
        now,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
