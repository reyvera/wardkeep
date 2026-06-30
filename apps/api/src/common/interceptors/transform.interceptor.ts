import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface TransformedResponse<T> {
  data: T;
  meta: {
    timestamp: string;
  };
}

/**
 * Wraps all successful responses in a standard envelope format with metadata.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformedResponse<T>> {
  /**
   * Intercepts outgoing responses and wraps them in a standard format.
   * @param _context - The execution context
   * @param next - The call handler to proceed with the request
   * @returns Observable with the transformed response
   */
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
