/**
 * Account domain types.
 */

/** Account type classification. */
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  LOAN = 'LOAN',
  MORTGAGE = 'MORTGAGE',
  HELOC = 'HELOC',
  CASH = 'CASH',
  MANUAL = 'MANUAL',
}

/** Account entity matching Prisma schema. */
export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  /** Stored as string for Decimal.js compatibility during serialization. */
  initialBalance: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
