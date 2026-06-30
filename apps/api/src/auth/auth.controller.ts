import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from '@budgetapp/shared';

import { AuthGuard } from '../common/guards/auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   * @param req - Express request with body { email, password, confirmPassword }
   * @returns Session token and expiry timestamp
   */
  @Post('register')
  async register(
    @Req() req: Request,
  ): Promise<{ token: string; expiresAt: Date }> {
    const result = RegisterSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    const { email, password } = result.data;
    return this.authService.register(email, password);
  }

  /**
   * Authenticate an existing user.
   * @param req - Express request with body { email, password }
   * @returns Session token and expiry timestamp
   */
  @Post('login')
  async login(
    @Req() req: Request,
  ): Promise<{ token: string; expiresAt: Date }> {
    const result = LoginSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    const { email, password } = result.data;
    return this.authService.login(email, password);
  }

  /**
   * Log out the current user by invalidating their session.
   * Requires a valid session token in the Authorization header.
   * @param req - Express request with user attached by AuthGuard
   */
  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request): Promise<void> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') ?? '';
    await this.authService.logout(token);
  }

  /**
   * Initiate a password reset flow.
   * Returns a generic message regardless of whether the email exists
   * to prevent email enumeration attacks.
   * @param req - Express request with body { email }
   * @returns Generic success message
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Req() req: Request): Promise<{ message: string }> {
    const result = ForgotPasswordSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    const { email } = result.data;
    return this.authService.forgotPassword(email);
  }

  /**
   * Reset a user's password using a valid reset token.
   * Invalidates all existing sessions for the user on success.
   * @param req - Express request with body { token, password, confirmPassword }
   * @returns Success message
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Req() req: Request): Promise<{ message: string }> {
    const result = ResetPasswordSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    const { token, password } = result.data;
    return this.authService.resetPassword(token, password);
  }
}
