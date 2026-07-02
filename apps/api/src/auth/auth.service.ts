import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  FAILED_LOGIN_WINDOW_MINUTES,
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGINS,
  RESET_TOKEN_EXPIRY_MINUTES,
  SESSION_TIMEOUT_MINUTES,
} from '@wardkeep/shared';

import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** Cost factor for bcrypt password hashing. */
const BCRYPT_COST_FACTOR = 10;

/** Session absolute expiry duration in hours. */
const SESSION_EXPIRY_HOURS = 24;

/** Default categories seeded for new users. */
const DEFAULT_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: 'Income', icon: '💰', color: '#22c55e' },
  { name: 'Housing', icon: '🏠', color: '#3b82f6' },
  { name: 'Food & Dining', icon: '🍽️', color: '#f59e0b' },
  { name: 'Transportation', icon: '🚗', color: '#8b5cf6' },
  { name: 'Utilities', icon: '💡', color: '#06b6d4' },
  { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { name: 'Shopping', icon: '🛒', color: '#f97316' },
  { name: 'Health', icon: '🏥', color: '#ef4444' },
  { name: 'Savings', icon: '🏦', color: '#10b981' },
  { name: 'Other', icon: '📋', color: '#6b7280' },
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Register a new user account.
   * @param email - User's email address (pre-validated, lowercased)
   * @param password - Plain text password to hash
   * @param ip - Optional IP address of the request origin
   * @returns Session token and expiry timestamp
   * @throws ConflictException if email is already registered
   */
  async register(
    email: string,
    password: string,
    ip?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    // Seed default categories for the new user
    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        userId: user.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      })),
    });

    await this.auditService.log(user.id, 'auth.register', { email }, ip);

    return this.createSession(user.id);
  }

  /**
   * Authenticate a user with email and password.
   * Tracks failed logins within a 10-minute window and locks account
   * after MAX_FAILED_LOGINS consecutive failures.
   * @param email - User's email address
   * @param password - Plain text password to verify
   * @param ip - Optional IP address of the request origin
   * @returns Session token and expiry timestamp
   * @throws UnauthorizedException if credentials are invalid or account is locked
   */
  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const now = new Date();
      const windowStart = new Date(
        now.getTime() - FAILED_LOGIN_WINDOW_MINUTES * 60 * 1000,
      );

      // Reset counter if the last failure was outside the 10-minute window
      const currentFailedLogins =
        user.lastFailedAt && user.lastFailedAt > windowStart
          ? user.failedLogins
          : 0;

      const failedLogins = currentFailedLogins + 1;
      const updateData: {
        failedLogins: number;
        lastFailedAt: Date;
        lockedUntil?: Date;
      } = {
        failedLogins,
        lastFailedAt: now,
      };

      // Lock account if max failed attempts reached within window
      if (failedLogins >= MAX_FAILED_LOGINS) {
        updateData.lockedUntil = new Date(
          now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
        await this.auditService.log(
          user.id,
          'auth.account_locked',
          { failedLogins, email },
          ip,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await this.auditService.log(
        user.id,
        'auth.login_failed',
        { email, failedLogins },
        ip,
      );

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed login counter on successful login
    if (user.failedLogins > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null, lastFailedAt: null },
      });
    }

    await this.auditService.log(user.id, 'auth.login', { email }, ip);

    return this.createSession(user.id);
  }

  /**
   * Invalidate a session by deleting it.
   * @param token - The session token to invalidate
   * @param userId - Optional user ID for audit logging
   * @param ip - Optional IP address for audit logging
   */
  async logout(token: string, userId?: string, ip?: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { token } });

    if (userId) {
      await this.auditService.log(userId, 'auth.logout', undefined, ip);
    }
  }

  /**
   * Validate a session token and return the associated user.
   * Checks both absolute expiry and inactivity timeout.
   * Updates lastActive on valid sessions.
   * @param token - The session token to validate
   * @returns The user associated with the session
   * @throws UnauthorizedException if session is invalid, expired, or inactive
   */
  async validateSession(token: string): Promise<{ id: string; email: string }> {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const now = new Date();

    // Check absolute expiry
    if (session.expiresAt < now) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check inactivity timeout
    const inactivityLimit = new Date(
      session.lastActive.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000,
    );

    if (inactivityLimit < now) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Update lastActive timestamp
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActive: now },
    });

    return session.user;
  }

  /**
   * Initiate a password reset by generating a single-use, time-limited token.
   * Always returns a generic success message to prevent email enumeration.
   * @param email - The email address to send the reset link to
   * @param ip - Optional IP address for audit logging
   * @returns Generic success message regardless of whether the email exists
   */
  async forgotPassword(email: string, ip?: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(
        Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
      );

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // In production, send the token via email. For now, log it.
      this.logger.log(
        `Password reset token generated for ${email}: ${token}`,
      );
    }

    return { message: 'If an account exists, a reset link has been sent' };
  }

  /**
   * Reset a user's password using a valid, single-use reset token.
   * Invalidates all existing sessions for the user on success.
   * @param token - The password reset token
   * @param newPassword - The new password to set
   * @param ip - Optional IP address for audit logging
   * @returns Success message
   * @throws BadRequestException if the token is invalid, expired, or already used
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ip?: string,
  ): Promise<{ message: string }> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

    // Update password, mark token as used, and invalidate all sessions atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
          lastFailedAt: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    await this.auditService.log(
      resetToken.userId,
      'auth.password_reset',
      { email: 'redacted' },
      ip,
    );

    return { message: 'Password reset successful' };
  }

  /**
   * Create a new session for a user.
   * @param userId - The ID of the user to create a session for
   * @returns Session token and expiry timestamp
   */
  private async createSession(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
        lastActive: new Date(),
      },
    });

    return { token, expiresAt };
  }
}
