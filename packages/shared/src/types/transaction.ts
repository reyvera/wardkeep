/**
 * Transaction domain types.
 */

/** Transaction direction. */
export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
}

/** Tag attached to a transaction. */
export interface TransactionTag {
  id: string;
  transactionId: string;
  tag: string;
}

/** Transaction entity matching Prisma schema. */
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  date: Date;
  /** Stored as string for Decimal.js compatibility during serialization. */
  amount: string;
  type: TransactionType;
  merchant: string | null;
  description: string | null;
  notes: string | null;
  isReconciliation: boolean;
  aiCategorized: boolean;
  /** AI confidence score 0.00–1.00, serialized as string. */
  aiConfidence: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: TransactionTag[];
}
