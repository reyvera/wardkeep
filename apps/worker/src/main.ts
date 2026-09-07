/**
 * Worker application entry point.
 * Starts BullMQ workers that consume job queues for background processing.
 */
import { Queue, Worker } from 'bullmq';

import { redisConfig } from './config';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from './queues';
import { processAICategorization } from './processors/ai-categorization.processor';
import { processRecurringDetection } from './processors/recurring-detection.processor';
import { processReadinessSnapshot } from './processors/readiness-snapshot.processor';
import { processScheduledBackups } from './processors/backup.processor';
import { processScheduledRemoteBackups } from './processors/remote-backup.processor';
import { processDailyBriefs } from './processors/daily-brief.processor';

const workers: Worker[] = [];
const queues: Queue[] = [];
const DAILY_BRIEF_CRON = process.env['WARDKEEP_DAILY_BRIEF_CRON']?.trim() || '15 3 * * *';

function log(message: string): void {
  process.stdout.write(`[wardkeep-worker] ${message}\n`);
}

async function bootstrap(): Promise<void> {
  const connection = redisConfig;

  // AI Categorization worker
  const aiWorker = new Worker(QUEUE_NAMES.AI_CATEGORIZATION, processAICategorization, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.AI_CATEGORIZATION],
  });
  workers.push(aiWorker);

  // Recurring detection worker
  const recurringWorker = new Worker(QUEUE_NAMES.RECURRING_DETECTION, processRecurringDetection, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.RECURRING_DETECTION],
  });
  workers.push(recurringWorker);

  // Daily readiness snapshots run independently of Dashboard visits. BullMQ
  // preserves the schedule in Redis across worker restarts.
  const readinessQueue = new Queue(QUEUE_NAMES.READINESS_SNAPSHOTS, { connection });
  queues.push(readinessQueue);
  await readinessQueue.upsertJobScheduler(
    'daily-readiness-snapshot',
    { pattern: '0 3 * * *' },
    { name: 'record-all-household-snapshots', data: {} },
  );
  log('Scheduled daily readiness snapshots for 03:00 UTC.');
  const readinessWorker = new Worker(QUEUE_NAMES.READINESS_SNAPSHOTS, processReadinessSnapshot, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.READINESS_SNAPSHOTS],
  });
  workers.push(readinessWorker);

  const briefQueue = new Queue(QUEUE_NAMES.DAILY_BRIEFS, { connection });
  queues.push(briefQueue);
  await briefQueue.upsertJobScheduler(
    'daily-advisor-briefs',
    { pattern: DAILY_BRIEF_CRON },
    { name: 'generate-daily-briefs', data: {} },
  );
  log(`Scheduled deterministic daily advisor briefs with cron: ${DAILY_BRIEF_CRON}.`);
  const briefWorker = new Worker(QUEUE_NAMES.DAILY_BRIEFS, processDailyBriefs, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.DAILY_BRIEFS],
  });
  workers.push(briefWorker);

  // Backups run after readiness snapshots. The API decides which household
  // schedules are due, making missed runs safe to catch up on the next job.
  const backupQueue = new Queue(QUEUE_NAMES.BACKUP, { connection });
  queues.push(backupQueue);
  await backupQueue.upsertJobScheduler(
    'scheduled-backups',
    { pattern: '0 4 * * *' },
    { name: 'create-due-backups', data: {} },
  );
  log('Scheduled automatic backups for 04:00 UTC.');
  const backupWorker = new Worker(QUEUE_NAMES.BACKUP, processScheduledBackups, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.BACKUP],
  });
  workers.push(backupWorker);

  // Remote copies have their own cadence. The API decides whether each peer is
  // due, so a missed worker run safely catches up without duplicate pushes.
  const remoteBackupQueue = new Queue(QUEUE_NAMES.REMOTE_BACKUP, { connection });
  queues.push(remoteBackupQueue);
  await remoteBackupQueue.upsertJobScheduler(
    'scheduled-remote-backups',
    { pattern: '0 * * * *' },
    { name: 'sync-due-remote-backups', data: {} },
  );
  log('Scheduled due remote backup copies hourly.');
  const remoteBackupWorker = new Worker(QUEUE_NAMES.REMOTE_BACKUP, processScheduledRemoteBackups, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.REMOTE_BACKUP],
  });
  workers.push(remoteBackupWorker);

  log('Started. Listening for jobs...');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  log('SIGTERM received. Shutting down gracefully...');
  await Promise.all([
    ...workers.map((worker) => worker.close()),
    ...queues.map((queue) => queue.close()),
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  log('SIGINT received. Shutting down gracefully...');
  await Promise.all([
    ...workers.map((worker) => worker.close()),
    ...queues.map((queue) => queue.close()),
  ]);
  process.exit(0);
});

bootstrap();
