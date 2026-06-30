/**
 * Category domain types.
 */

/** Category entity matching Prisma schema. */
export interface Category {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  children?: Category[];
}
