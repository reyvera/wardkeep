/**
 * Common validation schemas shared across the application.
 */
import { z } from 'zod';

import {
  PAGINATION_DEFAULT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX,
  PAGINATION_MIN,
} from '../constants/pagination';

/** UUID string validation. */
export const UuidSchema = z.string().uuid();

/** Pagination query parameters schema. */
export const PaginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(PAGINATION_DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(PAGINATION_MIN)
    .max(PAGINATION_MAX)
    .default(PAGINATION_DEFAULT),
});

/** Sort direction schema. */
export const SortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

/** Date range filter schema (ISO date strings). */
export const DateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  { message: 'from date must be before or equal to to date' },
);

export type PaginationInput = z.infer<typeof PaginationSchema>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
