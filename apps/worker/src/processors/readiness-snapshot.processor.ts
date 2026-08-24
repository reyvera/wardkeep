import { createHmac } from 'node:crypto';

const WORKER_TOKEN_PURPOSE = 'wardkeep:readiness-snapshot-worker:v1';

/** Calls the API's trusted internal endpoint to calculate and record daily readiness snapshots. */
export async function processReadinessSnapshot(): Promise<void> {
  const encryptionKey = process.env['ENCRYPTION_KEY'];
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required to run readiness snapshot jobs');
  }

  const workerToken = createHmac('sha256', encryptionKey)
    .update(WORKER_TOKEN_PURPOSE)
    .digest('hex');
  const apiUrl = (process.env['INTERNAL_API_URL'] ?? 'http://api:4000/api').replace(/\/$/, '');
  const response = await fetch(`${apiUrl}/internal/readiness/snapshots`, {
    method: 'POST',
    headers: { 'x-wardkeep-worker-token': workerToken },
  });

  if (!response.ok) {
    throw new Error(`Readiness snapshot request failed with HTTP ${response.status}`);
  }
}
