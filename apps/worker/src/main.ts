/**
 * Worker application entry point.
 * Starts BullMQ workers that consume job queues for background processing.
 */
import { Worker } from 'bullmq';

import { redisConfig } from './config';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from './queues';
import { processAICategorization } from './processors/ai-categorization.processor';
import { processRecurringDetection } from './processors/recurring-detection.processor';

const workers: Worker[] = [];

async function bootstrap(): Promise<void> {
  const connection = redisConfig;

  // AI Categorization worker
  const aiWorker = new Worker(QUEUE_NAMES.AI_CATEGORIZATION, processAICategorization, {
    connection,
    concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.AI_CATEGORIZATION],
  });
  workers.push(aiWorker);

  // Recurring detection worker
  const recurringWorker = new Worker(
    QUEUE_NAMES.RECURRING_DETECTION,
    processRecurringDetection,
    {
      connection,
      concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.RECURRING_DETECTION],
    },
  );
  workers.push(recurringWorker);

  console.log('Worker started. Listening for jobs...');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

bootstrap();
