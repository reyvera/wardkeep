import {
  RemotePeerAddressResolver,
  resolveRemoteBackupPeerAddresses,
  validateRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

/**
 * Returns this deployment's publicly reachable identity for outbound pairing.
 * It is deliberately resolved at the moment pairing begins rather than at
 * application startup, so deployments that do not use remote backup stay
 * usable without a public URL or public DNS.
 */
export async function getRemoteBackupPublicUrl(
  value = process.env['WARDKEEP_PUBLIC_URL'],
  resolveAddresses: RemotePeerAddressResolver = resolveRemoteBackupPeerAddresses,
): Promise<string> {
  const publicUrl = value?.trim();
  if (!publicUrl) {
    throw new Error('Remote backup pairing requires WARDKEEP_PUBLIC_URL');
  }

  const url = await validateRemoteBackupPeerUrl(publicUrl, resolveAddresses);
  return url.origin;
}
