import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** Valid audit log action types for authentication events. */
export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_reset'
  | 'auth.account_locked';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry for a security-relevant event.
   * Audit logs are append-only and used for security monitoring.
   * @param userId - The ID of the user associated with the event
   * @param action - The type of action being logged
   * @param details - Optional additional context about the event
   * @param ip - Optional IP address of the request origin
   */
  async log(
    userId: string,
    action: AuditAction,
    details?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          details: details ? (details as Prisma.InputJsonValue) : undefined,
          ip: ip ?? undefined,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.error(
        `Failed to write audit log: ${action} for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
