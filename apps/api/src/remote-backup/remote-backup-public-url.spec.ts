import { describe, expect, it } from 'vitest';

import { getRemoteBackupPublicUrl } from './remote-backup-public-url';

describe('remote backup public URL configuration', () => {
  const publicResolver = async () => ['203.0.113.10'];

  it('requires an explicit public URL only when outbound pairing begins', async () => {
    await expect(getRemoteBackupPublicUrl(undefined, publicResolver)).rejects.toThrow(
      'WARDKEEP_PUBLIC_URL',
    );
  });

  it('normalizes a public HTTPS origin', async () => {
    await expect(
      getRemoteBackupPublicUrl(' https://wardkeep.example/ ', publicResolver),
    ).resolves.toBe('https://wardkeep.example');
  });

  it('uses the same public HTTPS and SSRF controls as peer URLs', async () => {
    await expect(
      getRemoteBackupPublicUrl('http://wardkeep.example', publicResolver),
    ).rejects.toThrow('HTTPS');
    await expect(
      getRemoteBackupPublicUrl('https://wardkeep.example', async () => ['127.0.0.1']),
    ).rejects.toThrow('non-public');
  });
});
