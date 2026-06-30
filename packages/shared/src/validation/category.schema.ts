/**
 * Category validation schemas.
 */
import { z } from 'zod';

import { CATEGORY_NAME_MAX_LENGTH } from '../constants/limits';
import { UuidSchema } from './common.schema';

/** Schema for creating a new category. */
export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(CATEGORY_NAME_MAX_LENGTH).trim(),
  parentId: UuidSchema.nullable().optional(),
  icon: z.string().max(50).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #FF0000)' })
    .optional(),
});

/** Schema for updating an existing category. */
export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(CATEGORY_NAME_MAX_LENGTH).trim().optional(),
  parentId: UuidSchema.nullable().optional(),
  icon: z.string().max(50).trim().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #FF0000)' })
    .nullable()
    .optional(),
});

/** Schema for merging two categories. */
export const MergeCategorySchema = z.object({
  sourceCategoryId: UuidSchema,
  targetCategoryId: UuidSchema,
}).refine(
  (data) => data.sourceCategoryId !== data.targetCategoryId,
  { message: 'Source and target categories must be different' },
);

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type MergeCategoryInput = z.infer<typeof MergeCategorySchema>;
