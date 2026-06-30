/**
 * Common shared types used across the application.
 */

/** Pagination metadata returned with list responses. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Standard API error response shape. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: FieldError[];
}

/** Field-level validation error detail. */
export interface FieldError {
  field: string;
  message: string;
}

/** Sort direction for list queries. */
export type SortDirection = 'asc' | 'desc';

/** Date range filter. */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Serialized date range (for API transport). */
export interface DateRangeDto {
  from: string;
  to: string;
}
