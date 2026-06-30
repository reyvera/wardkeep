import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGINS,
  SESSION_TIMEOUT_MINUTES,
} from '@budgetapp/shared';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new user account.
   * @param email - User's email address (pre-validated, lowercased)
   * @param password - Plain text password to hash
   * @returns Session token and expiry timestamp
   * @throws ConflictException if email is already registered
   */
  async register(
    email: string,
    password: string,
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

    return this.createSession(user.id);
  }

  /**
   * Authenticate a user with email and password.
   * @param email - User's email address
   * @param password - Plain text password to verify
   * @returns Session token and expiry timestamp
   * @throws UnauthorizedException if credentials are invalid or account is locked
   */
  async login(
    email: string,
    password: string,
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
      const failedLogins = user.failedLogins + 1;
      const updateData: { failedLogins: number; lockedUntil?: Date } = {
        failedLogins,
      };

      // Lock account if max failed attempts reached
      if (failedLogins >= MAX_FAILED_LOGINS) {
        updateData.lockedUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed login counter on successful login
    if (user.failedLogins > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }

    return this.createSession(user.id);
  }

  /**
   * Invalidate a session by deleting it.
   * @param token - The session token to invalidate
   */
  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { token } });
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
