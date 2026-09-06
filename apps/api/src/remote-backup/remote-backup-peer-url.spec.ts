import { describe, expect, it } from 'vitest';

import { isPublicRemotePeerAddress, validateRemoteBackupPeerUrl } from './remote-backup-peer-url';

describe('remote backup peer URL validation', () => {
  const publicResolver = async () => ['203.0.113.10'];

  it('accepts an HTTPS origin resolving only to a public address', async () => {
    await expect(
      validateRemoteBackupPeerUrl('https://peer.example', publicResolver),
    ).resolves.toMatchObject({
      origin: 'https://peer.example',
    });
  });

  it('rejects URLs that are not a plain HTTPS origin', async () => {
    for (const value of [
      'http://peer.example',
      'https://person:secret@peer.example',
      'https://peer.example/remote-backup',
      'https://peer.example/#fragment',
      'not a URL',
    ]) {
      await expect(validateRemoteBackupPeerUrl(value, publicResolver)).rejects.toThrow();
    }
  });

  it('rejects local, private, link-local, carrier-grade, and multicast destinations', async () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.1.1',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '224.0.0.1',
      '::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
    ]) {
      expect(isPublicRemotePeerAddress(address)).toBe(false);
      await expect(
        validateRemoteBackupPeerUrl('https://peer.example', async () => [address]),
      ).rejects.toThrow('non-public');
    }
    await expect(validateRemoteBackupPeerUrl('https://localhost', publicResolver)).rejects.toThrow(
      'localhost',
    );
  });
});
