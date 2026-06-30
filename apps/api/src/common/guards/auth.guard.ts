import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * Placeholder authentication guard.
 * Currently allows all requests through. Will be replaced with real auth logic
 * once the authentication module is implemented.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Determines whether the current request is allowed to proceed.
   * @param _context - The execution context
   * @returns true (placeholder — always allows access)
   */
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
