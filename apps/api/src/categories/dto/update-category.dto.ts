import { z } from 'zod';

import { CATEGORY_NAME_MAX_LENGTH } from '@wardkeep/shared';

/**
 * Zod schema for updating a category.
 * All fields are optional; only provided fields will be updated.
 */
export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(CATEGORY_NAME_MAX_LENGTH).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
