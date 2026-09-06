import { request } from 'node:https';
import { isIP } from 'node:net';

import {
  RemotePeerAddressResolver,
  resolveRemoteBackupPeerAddresses,
  resolveRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export interface RemoteBackupPairingTransportResponse {
  statusCode: number;
  body: Buffer;
}

export type RemoteBackupPairingTransport = (input: {
  address: string;
  hostname: string;
  port: number;
  path: string;
  body: Buffer;
}) => Promise<RemoteBackupPairingTransportResponse>;

/**
 * Uses the address that passed URL validation, rather than letting a second
 * DNS lookup choose the destination. This prevents a peer hostname from
 * rebinding between validation and the outbound HTTPS connection.
 */
export async function redeemRemoteBackupOffer(
  peerUrl: string,
  payload: {
    offerId: string;
    secret: string;
    remotePeerId: string;
    peerUrl: string;
    peerName: string;
    direction: string;
  },
  options: {
    resolveAddresses?: RemotePeerAddressResolver;
    transport?: RemoteBackupPairingTransport;
  } = {},
) {
  const destination = await resolveRemoteBackupPeerUrl(
    peerUrl,
    options.resolveAddresses ?? resolveRemoteBackupPeerAddresses,
  );
  const body = Buffer.from(JSON.stringify(payload));
  const response = await (options.transport ?? postJson)({
    address: destination.address,
    hostname: destination.url.hostname.replace(/^\[|\]$/g, ''),
    port: destination.url.port ? Number(destination.url.port) : 443,
    path: '/api/remote-backup/pair/redeem',
    body,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error('Remote backup pairing was rejected');
  }

  let result: unknown;
  try {
    result = JSON.parse(response.body.toString('utf8'));
  } catch {
    throw new Error('Remote backup pairing returned an invalid response');
  }
  return result;
}

const postJson: RemoteBackupPairingTransport = ({ address, hostname, port, path, body }) =>
  new Promise((resolve, reject) => {
    const client = request(
      {
        protocol: 'https:',
        hostname: address,
        port,
        path,
        method: 'POST',
        servername: isIP(hostname) ? undefined : hostname,
        headers: {
          host: port === 443 ? hostname : `${hostname}:${port}`,
          'content-type': 'application/json',
          'content-length': body.length,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) {
            response.destroy(new Error('Remote backup pairing response is too large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks) }),
        );
      },
    );
    client.on('timeout', () => client.destroy(new Error('Remote backup pairing timed out')));
    client.on('error', reject);
    client.end(body);
  });
