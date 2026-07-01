/**
 * AI Categorization processor — categorizes uncategorized transactions
 * using the AI engine with user correction history.
 */
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  AICategorizer,
  OllamaProvider,
  AI_CONFIDENCE_AUTO_ASSIGN,
  AI_CONFIDENCE_SUGGEST,
} from '@budgetapp/ai-engine';

const prisma = new PrismaClient();
const provider = new OllamaProvider();
const categorizer = new AICategorizer(provider);

interface AICategorizeJobData {
  userId: string;
}

/**
 * Process AI categorization jobs for a user's uncategorized transactions.
 * Fetches up to 100 uncategorized transactions per job, then assigns or suggests
 * categories based on AI confidence thresholds.
 * @param job - BullMQ job containing userId.
 */
export async function processAICategorization(job: Job): Promise<void> {
  const { userId } = job.data as AICategorizeJobData;

  // Get uncategorized transactions for this user (batch of 100)
  const transactions = await prisma.transaction.findMany({
    where: { userId, categoryId: null, aiCategorized: false },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  if (transactions.length === 0) return;

  // Get user's categories
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  // Get user corrections for merchant → category overrides
  const corrections = await prisma.aICorrection.findMany({
    where: { userId },
  });
  const correctionMap = new Map(
    corrections.map((c) => [c.merchant.toLowerCase(), c.categoryId]),
  );

  // Process each transaction
  for (const tx of transactions) {
    try {
      const suggestion = await categorizer.categorize(
        {
          merchant: tx.merchant,
          amount: tx.amount.toString(),
          description: tx.description,
        },
        categories,
        correctionMap,
      );

      if (suggestion.confidence >= AI_CONFIDENCE_AUTO_ASSIGN && suggestion.categoryId) {
        // High confidence — auto-assign the category
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            categoryId: suggestion.categoryId,
            aiCategorized: true,
            aiConfidence: suggestion.confidence,
          },
        });
      } else if (suggestion.confidence >= AI_CONFIDENCE_SUGGEST && suggestion.categoryId) {
        // Medium confidence — mark as processed but don't assign
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { aiCategorized: true, aiConfidence: suggestion.confidence },
        });
      } else {
        // Low confidence — mark as processed with low score
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { aiCategorized: true, aiConfidence: suggestion.confidence },
        });
      }
    } catch {
      // AI unavailable — leave as uncategorized, will retry next cycle
      continue;
    }
  }
}
