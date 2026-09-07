import { createHmac } from 'node:crypto';

const PURPOSE = 'wardkeep:daily-advisor-brief-worker:v1';

/** Requests local deterministic daily briefs after the readiness snapshot has run. */
export async function processDailyBriefs(): Promise<void> {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY is required to generate daily briefs');
  const token = createHmac('sha256', key).update(PURPOSE).digest('hex');
  const apiUrl = (process.env['INTERNAL_API_URL'] ?? 'http://api:4000/api').replace(/\/$/, '');
  const response = await fetch(`${apiUrl}/internal/advisor/briefs`, {
    method: 'POST', headers: { 'x-wardkeep-worker-token': token },
  });
  if (!response.ok) throw new Error(`Daily brief request failed with HTTP ${response.status}`);
}
