import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

/** Extended request interface with authenticated user and scoped userId. */
export interface ScopedRequest extends Request {
  user?: { id: string; email: string };
  userId?: string;
}

/**
 * Injects the authenticated user's ID into the request object for per-user data isolation.
 * Runs after AuthGuard has attached the user. Services can access `request.userId`
 * to scope all database queries to the current user.
 */
@Injectable()
export class UserScopeInterceptor implements NestInterceptor {
  /**
   * Extracts userId from the authenticated user and attaches it to the request.
   * @param context - The execution context for the current request
   * @param next - The call handler to proceed with the request
   * @returns Observable that continues the request pipeline
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();

    if (request.user?.id) {
      request.userId = request.user.id;
    }

    return next.handle();
  }
}
