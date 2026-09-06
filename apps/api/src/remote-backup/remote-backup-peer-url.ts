import { isIP } from 'node:net';

export type RemotePeerAddressResolver = (hostname: string) => Promise<string[]>;

/**
 * Validates a peer URL and all DNS answers immediately before a connection.
 * Callers must invoke this again for every outbound request to reduce DNS
 * rebinding risk.
 */
export async function validateRemoteBackupPeerUrl(
  value: string,
  resolveAddresses: RemotePeerAddressResolver,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Remote backup peer URL must be an absolute HTTPS URL');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== '/' ||
    url.search
  ) {
    throw new Error('Remote backup peer URL must be an HTTPS origin without credentials or a path');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Remote backup peers cannot use localhost');
  }

  const addresses = isIP(hostname) ? [hostname] : await resolveAddresses(hostname);
  if (addresses.length === 0 || addresses.some((address) => !isPublicRemotePeerAddress(address))) {
    throw new Error('Remote backup peer URL resolves to a non-public address');
  }

  return url;
}

export function isPublicRemotePeerAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const [first, second] = address.split('.').map(Number);
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && (second === 0 || second === 168)) return false;
  if (first === 198 && (second === 18 || second === 19)) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:')) return false;
  const firstSegment = normalized.split(':')[0];
  const first = Number.parseInt(firstSegment, 16);
  return !(
    normalized.startsWith('fe80:') ||
    (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xff00 && first <= 0xffff)
  );
}
