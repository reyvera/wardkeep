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

const workers: Worker[] = [];
const queues: Queue[] = [];

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
