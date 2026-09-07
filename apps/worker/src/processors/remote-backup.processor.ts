import { createHmac } from 'node:crypto';

const WORKER_TOKEN_PURPOSE = 'wardkeep:scheduled-remote-backup-worker:v1';

/** Calls the API's trusted endpoint to deliver every off-site copy that is due. */
export async function processScheduledRemoteBackups(): Promise<void> {
  const encryptionKey = process.env['ENCRYPTION_KEY'];
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required to run remote backup jobs');
  }
  const workerToken = createHmac('sha256', encryptionKey)
    .update(WORKER_TOKEN_PURPOSE)
    .digest('hex');
  const apiUrl = (process.env['INTERNAL_API_URL'] ?? 'http://api:4000/api').replace(/\/$/, '');
  const response = await fetch(`${apiUrl}/internal/remote-backups/run-due`, {
    method: 'POST',
    headers: { 'x-wardkeep-worker-token': workerToken },
  });
  if (!response.ok) {
    throw new Error(`Scheduled remote backup request failed with HTTP ${response.status}`);
  }
}
