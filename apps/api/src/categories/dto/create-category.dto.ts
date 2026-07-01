import { z } from 'zod';

import { CATEGORY_NAME_MAX_LENGTH } from '@budgetapp/shared';

/**
 * Zod schema for creating a new category.
 * Validates name, optional parentId, icon, and color fields.
 */
export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(CATEGORY_NAME_MAX_LENGTH),
  parentId: z.string().uuid().optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;

/**
 * Zod schema for merging two categories.
 * Reassigns all transactions from source to target, then deletes source.
 */
export const MergeCategoriesSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export type MergeCategoriesDto = z.infer<typeof MergeCategoriesSchema>;
