import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

/** In-memory store for encrypted backup data (filesystem/S3 can replace this later). */
const backupStore = new Map<string, Buffer>();

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an encrypted backup of all user data.
   * Exports accounts, transactions, tags, categories, budgets, allocations,
   * rules, conditions, actions, recurring transactions, and settings.
   * Enforces retention limit by deleting oldest backups when exceeded.
   * @param userId - The authenticated user's ID
   * @param passphrase - User-provided passphrase for AES-256-GCM encryption
   * @returns The created backup metadata
   */
  async createBackup(userId: string, passphrase: string) {
    const [
      accounts,
      transactions,
      tags,
      categories,
      budgets,
      allocations,
      rules,
      conditions,
      actions,
      recurring,
      settings,
    ] = await Promise.all([
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { userId } }),
      this.prisma.transactionTag.findMany({
        where: { transaction: { userId } },
      }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.budget.findMany({ where: { userId } }),
      this.prisma.budgetAllocation.findMany({
        where: { budget: { userId } },
      }),
      this.prisma.rule.findMany({ where: { userId } }),
      this.prisma.ruleCondition.findMany({ where: { rule: { userId } } }),
      this.prisma.ruleAction.findMany({ where: { rule: { userId } } }),
      this.prisma.recurringTransaction.findMany({ where: { userId } }),
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    const payload = JSON.stringify({
      accounts,
      transactions,
      tags,
      categories,
      budgets,
      allocations,
      rules,
      conditions,
      actions,
      recurring,
      settings,
    });

    const data = Buffer.from(payload, 'utf-8');
    const { encrypted, iv, salt, authTag } = this.encrypt(data, passphrase);

    // Pack: salt(32) + iv(16) + authTag(16) + encrypted
    const packed = Buffer.concat([salt, iv, authTag, encrypted]);

    const backup = await this.prisma.backup.create({
      data: {
        userId,
        filename: `backup-${Date.now()}.enc`,
        size: BigInt(packed.length),
      },
    });

    backupStore.set(backup.id, packed);

    // Enforce retention limit
    await this.enforceRetention(userId);

    return {
      id: backup.id,
      filename: backup.filename,
      size: Number(backup.size),
      createdAt: backup.createdAt,
    };
  }

  /**
   * Restores user data from an encrypted backup.
   * Validates the auth tag before modifying any data. On incorrect passphrase,
   * throws BadRequestException without altering existing data.
   * @param userId - The authenticated user's ID
   * @param backupId - The backup ID to restore from
   * @param passphrase - The passphrase used when creating the backup
   * @returns Success confirmation
   * @throws NotFoundException if backup does not exist or belongs to another user
   * @throws BadRequestException if passphrase is incorrect (auth tag validation fails)
   */
  async restoreBackup(userId: string, backupId: string, passphrase: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id: backupId, userId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const packed = backupStore.get(backupId);
    if (!packed) {
      throw new NotFoundException('Backup data not found');
    }

    // Unpack: salt(32) + iv(16) + authTag(16) + encrypted
    const salt = packed.subarray(0, 32);
    const iv = packed.subarray(32, 48);
    const authTag = packed.subarray(48, 64);
    const encrypted = packed.subarray(64);

    let decrypted: Buffer;
    try {
      decrypted = this.decrypt(encrypted, passphrase, iv, salt, authTag);
    } catch {
      throw new BadRequestException('Invalid passphrase');
    }

    const payload = JSON.parse(decrypted.toString('utf-8'));

    // Restore in a transaction: delete existing data then re-insert
    await this.prisma.$transaction(async (tx) => {
      // Delete in reverse dependency order
      await tx.transactionTag.deleteMany({ where: { transaction: { userId } } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.budgetAllocation.deleteMany({ where: { budget: { userId } } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.ruleCondition.deleteMany({ where: { rule: { userId } } });
      await tx.ruleAction.deleteMany({ where: { rule: { userId } } });
      await tx.rule.deleteMany({ where: { userId } });
      await tx.recurringTransaction.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.userSettings.deleteMany({ where: { userId } });

      // Re-insert data
      if (payload.accounts?.length) {
        await tx.account.createMany({ data: payload.accounts });
      }
      if (payload.categories?.length) {
        await tx.category.createMany({ data: payload.categories });
      }
      if (payload.transactions?.length) {
        await tx.transaction.createMany({ data: payload.transactions });
      }
      if (payload.tags?.length) {
        await tx.transactionTag.createMany({ data: payload.tags });
      }
      if (payload.budgets?.length) {
        await tx.budget.createMany({ data: payload.budgets });
      }
      if (payload.allocations?.length) {
        await tx.budgetAllocation.createMany({ data: payload.allocations });
      }
      if (payload.rules?.length) {
        await tx.rule.createMany({ data: payload.rules });
      }
      if (payload.conditions?.length) {
        await tx.ruleCondition.createMany({ data: payload.conditions });
      }
      if (payload.actions?.length) {
        await tx.ruleAction.createMany({ data: payload.actions });
      }
      if (payload.recurring?.length) {
        await tx.recurringTransaction.createMany({ data: payload.recurring });
      }
      if (payload.settings) {
        await tx.userSettings.create({ data: payload.settings });
      }
    });

    return { message: 'Backup restored successfully' };
  }

  /**
   * Lists all backup metadata for a user, ordered by creation date descending.
   * @param userId - The authenticated user's ID
   * @returns Array of backup metadata (id, filename, size, createdAt)
   */
  async listBackups(userId: string) {
    const backups = await this.prisma.backup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        size: true,
        createdAt: true,
      },
    });

    return backups.map((b) => ({
      id: b.id,
      filename: b.filename,
      size: Number(b.size),
      createdAt: b.createdAt,
    }));
  }

  /**
   * Sets or clears the automatic backup schedule for a user.
   * @param userId - The authenticated user's ID
   * @param schedule - The schedule frequency or null to disable
   * @returns The updated schedule setting
   */
  async setSchedule(userId: string, schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: { backupSchedule: schedule },
      create: {
        userId,
        backupSchedule: schedule,
      },
    });

    return { backupSchedule: settings.backupSchedule };
  }

  /**
   * Encrypts data using AES-256-GCM with a passphrase-derived key.
   * @param data - The plaintext data buffer
   * @param passphrase - The user-provided passphrase
   * @returns Object containing encrypted data, IV, salt, and auth tag
   */
  private encrypt(
    data: Buffer,
    passphrase: string,
  ): { encrypted: Buffer; iv: Buffer; salt: Buffer; authTag: Buffer } {
    const salt = randomBytes(32);
    const key = scryptSync(passphrase, salt, 32);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { encrypted, iv, salt, authTag };
  }

  /**
   * Decrypts AES-256-GCM encrypted data using a passphrase-derived key.
   * @param encrypted - The encrypted data buffer
   * @param passphrase - The user-provided passphrase
   * @param iv - The initialization vector used during encryption
   * @param salt - The salt used for key derivation
   * @param authTag - The authentication tag for integrity verification
   * @returns The decrypted plaintext buffer
   * @throws Error if auth tag validation fails (incorrect passphrase)
   */
  private decrypt(
    encrypted: Buffer,
    passphrase: string,
    iv: Buffer,
    salt: Buffer,
    authTag: Buffer,
  ): Buffer {
    const key = scryptSync(passphrase, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Enforces backup retention limit by deleting oldest backups when count exceeds the limit.
   * Uses the user's configured retention setting (default: 5).
   * @param userId - The authenticated user's ID
   */
  private async enforceRetention(userId: string): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { backupRetention: true },
    });

    const maxBackups = settings?.backupRetention ?? 5;

    const backups = await this.prisma.backup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      const idsToDelete = toDelete.map((b) => b.id);

      await this.prisma.backup.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      // Clean up in-memory store
      for (const id of idsToDelete) {
        backupStore.delete(id);
      }
    }
  }
}
