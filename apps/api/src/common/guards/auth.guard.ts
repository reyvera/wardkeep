import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  /**
   * Validates the session token from the Authorization header.
   * Attaches the authenticated user to the request object.
   * @param context - The execution context for the current request
   * @returns true if the session is valid
   * @throws UnauthorizedException if token is missing, invalid, or expired
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const user = await this.authService.validateSession(token);
    (request as Request & { user: { id: string; email: string } }).user = user;

    return true;
  }

  /**
   * Extract the Bearer token from the Authorization header.
   * @param request - The incoming HTTP request
   * @returns The token string or null if not present
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.slice(7);
  }
}
