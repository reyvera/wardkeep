/**
 * Queue name constants and concurrency settings for BullMQ workers.
 */

export const QUEUE_NAMES = {
  AI_CATEGORIZATION: 'ai-categorization',
  IMPORT_PROCESSING: 'import-processing',
  RECURRING_DETECTION: 'recurring-detection',
  BACKUP: 'backup',
  RULES_APPLY: 'rules-apply',
  NOTIFICATIONS: 'notifications',
} as const;

export const QUEUE_CONCURRENCY = {
  [QUEUE_NAMES.AI_CATEGORIZATION]: 1,
  [QUEUE_NAMES.IMPORT_PROCESSING]: 2,
  [QUEUE_NAMES.RECURRING_DETECTION]: 1,
  [QUEUE_NAMES.BACKUP]: 1,
  [QUEUE_NAMES.RULES_APPLY]: 2,
  [QUEUE_NAMES.NOTIFICATIONS]: 5,
} as const;
