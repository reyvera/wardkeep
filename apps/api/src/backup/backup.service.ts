import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';

function backupDirectory(): string {
  return process.env['WARDKEEP_BACKUP_DIR'] ?? '/data/backups';
}

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Creates a scheduled backup using a random per-user key protected by the deployment key. */
  async createScheduledBackup(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { scheduledBackupKey: true },
    });
    let key = settings?.scheduledBackupKey
      ? this.encryption.decrypt(settings.scheduledBackupKey)
      : null;
    if (!key) {
      key = randomBytes(32).toString('base64');
      await this.prisma.userSettings.upsert({
        where: { userId },
        create: { userId, scheduledBackupKey: this.encryption.encrypt(key) },
        update: { scheduledBackupKey: this.encryption.encrypt(key) },
      });
    }
    const backup = await this.createBackup(userId, key, { isAutomated: true });
    await this.prisma.userSettings.update({
      where: { userId },
      data: { scheduledBackupLastRunAt: new Date() },
    });
    return backup;
  }

  async runDueScheduledBackups(now = new Date()) {
    const settings = await this.prisma.userSettings.findMany({
      where: { backupSchedule: { not: null } },
      select: { userId: true, backupSchedule: true, scheduledBackupLastRunAt: true },
    });
    let created = 0;
    for (const setting of settings) {
      if (this.isScheduleDue(setting.backupSchedule, setting.scheduledBackupLastRunAt, now)) {
        await this.createScheduledBackup(setting.userId);
        created++;
      }
    }
    return { created };
  }

  /**
   * Creates an encrypted backup of all user data.
   * Exports household records, readiness history, and user settings. Authentication
   * sessions, provider credentials, and shared-access grants intentionally remain
   * deployment-local and are not restored by this per-user recovery workflow.
   * Enforces retention limit by deleting oldest backups when exceeded.
   * @param userId - The authenticated user's ID
   * @param passphrase - User-provided passphrase for AES-256-GCM encryption
   * @returns The created backup metadata
   */
  async createBackup(userId: string, passphrase: string, options: { isAutomated?: boolean } = {}) {
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
      financialGoals,
      vehicles,
      vehicleMaintenance,
      homeAssets,
      homeMaintenanceTasks,
      emergencyPreparednessItems,
      householdTransitionPlans,
      householdTransitionContacts,
      cashflowEvents,
      investmentHoldings,
      investmentQuoteSnapshots,
      realEstateProfiles,
      debtProfiles,
      insurancePolicies,
      estateDocuments,
      incomeSources,
      dependents,
      householdObligations,
      plannedExpenses,
      capabilitySettings,
      recommendations,
      advisorInsights,
      savedPayoffPlans,
      aiCorrections,
      handoffSummaries,
      readinessSnapshots,
      readinessObservations,
      readinessSignals,
      readinessScoreChanges,
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
      this.prisma.financialGoal.findMany({ where: { userId } }),
      this.prisma.vehicle.findMany({ where: { userId } }),
      this.prisma.vehicleMaintenance.findMany({ where: { vehicle: { userId } } }),
      this.prisma.homeAsset.findMany({ where: { userId } }),
      this.prisma.homeMaintenanceTask.findMany({ where: { userId } }),
      this.prisma.emergencyPreparednessItem.findMany({ where: { userId } }),
      this.prisma.householdTransitionPlan.findMany({ where: { userId } }),
      this.prisma.householdTransitionContact.findMany({ where: { userId } }),
      this.prisma.cashflowEvent.findMany({ where: { userId } }),
      this.prisma.investmentHolding.findMany({ where: { account: { userId } } }),
      this.prisma.investmentQuoteSnapshot.findMany({
        where: { holding: { account: { userId } } },
      }),
      this.prisma.realEstateProfile.findMany({ where: { account: { userId } } }),
      this.prisma.debtProfile.findMany({ where: { userId } }),
      this.prisma.insurancePolicy.findMany({ where: { userId } }),
      this.prisma.estateDocument.findMany({ where: { userId } }),
      this.prisma.incomeSource.findMany({ where: { userId } }),
      this.prisma.dependent.findMany({ where: { userId } }),
      this.prisma.householdObligation.findMany({ where: { userId } }),
      this.prisma.plannedExpense.findMany({ where: { userId } }),
      this.prisma.capabilitySetting.findMany({ where: { userId } }),
      this.prisma.recommendation.findMany({ where: { userId } }),
      this.prisma.advisorInsight.findMany({ where: { userId } }),
      this.prisma.savedPayoffPlan.findMany({ where: { userId } }),
      this.prisma.aICorrection.findMany({ where: { userId } }),
      this.prisma.handoffSummary.findMany({ where: { userId } }),
      this.prisma.readinessSnapshot.findMany({ where: { userId } }),
      this.prisma.readinessObservation.findMany({ where: { userId } }),
      this.prisma.readinessSignal.findMany({ where: { userId } }),
      this.prisma.readinessScoreChange.findMany({ where: { snapshot: { userId } } }),
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
      financialGoals,
      vehicles,
      vehicleMaintenance,
      homeAssets,
      homeMaintenanceTasks,
      emergencyPreparednessItems,
      householdTransitionPlans,
      householdTransitionContacts,
      cashflowEvents,
      investmentHoldings,
      investmentQuoteSnapshots,
      realEstateProfiles,
      debtProfiles,
      insurancePolicies,
      estateDocuments,
      incomeSources,
      dependents,
      householdObligations,
      plannedExpenses,
      capabilitySettings,
      recommendations,
      advisorInsights,
      savedPayoffPlans,
      aiCorrections,
      handoffSummaries,
      readinessSnapshots,
      readinessObservations,
      readinessSignals,
      readinessScoreChanges,
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
        isAutomated: options.isAutomated ?? false,
      },
    });

    try {
      await this.writeBackup(backup.id, packed);
    } catch (error) {
      await this.prisma.backup.delete({ where: { id: backup.id } });
      throw error;
    }

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
   * @param passphrase - The passphrase for a manual backup; automatic backups use their protected service key
   * @returns Success confirmation
   * @throws NotFoundException if backup does not exist or belongs to another user
   * @throws BadRequestException if passphrase is incorrect (auth tag validation fails)
   */
  async restoreBackup(userId: string, backupId: string, passphrase?: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id: backupId, userId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    let packed: Buffer;
    try {
      packed = await readFile(this.backupPath(backupId));
    } catch {
      throw new NotFoundException('Backup data not found');
    }

    // Unpack: salt(32) + iv(16) + authTag(16) + encrypted
    const salt = packed.subarray(0, 32);
    const iv = packed.subarray(32, 48);
    const authTag = packed.subarray(48, 64);
    const encrypted = packed.subarray(64);

    const restoreKey = backup.isAutomated
      ? await this.scheduledBackupKey(userId)
      : (passphrase ?? '');

    let decrypted: Buffer;
    try {
      decrypted = this.decrypt(encrypted, restoreKey, iv, salt, authTag);
    } catch {
      throw new BadRequestException('Invalid passphrase');
    }

    const payload = JSON.parse(decrypted.toString('utf-8'));

    // Restore in a transaction: delete existing data then re-insert
    await this.prisma.$transaction(async (tx) => {
      // Delete in reverse dependency order
      await tx.transactionTag.deleteMany({ where: { transaction: { userId } } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.cashflowEvent.deleteMany({ where: { userId } });
      await tx.investmentQuoteSnapshot.deleteMany({ where: { holding: { account: { userId } } } });
      await tx.investmentHolding.deleteMany({ where: { account: { userId } } });
      await tx.realEstateProfile.deleteMany({ where: { account: { userId } } });
      await tx.debtProfile.deleteMany({ where: { userId } });
      await tx.budgetAllocation.deleteMany({ where: { budget: { userId } } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.ruleCondition.deleteMany({ where: { rule: { userId } } });
      await tx.ruleAction.deleteMany({ where: { rule: { userId } } });
      await tx.rule.deleteMany({ where: { userId } });
      await tx.recurringTransaction.deleteMany({ where: { userId } });
      await tx.financialGoal.deleteMany({ where: { userId } });
      await tx.vehicleMaintenance.deleteMany({ where: { vehicle: { userId } } });
      await tx.vehicle.deleteMany({ where: { userId } });
      await tx.homeMaintenanceTask.deleteMany({ where: { userId } });
      await tx.homeAsset.deleteMany({ where: { userId } });
      await tx.emergencyPreparednessItem.deleteMany({ where: { userId } });
      await tx.householdTransitionPlan.deleteMany({ where: { userId } });
      await tx.householdTransitionContact.deleteMany({ where: { userId } });
      await tx.insurancePolicy.deleteMany({ where: { userId } });
      await tx.estateDocument.deleteMany({ where: { userId } });
      await tx.incomeSource.deleteMany({ where: { userId } });
      await tx.dependent.deleteMany({ where: { userId } });
      await tx.householdObligation.deleteMany({ where: { userId } });
      await tx.plannedExpense.deleteMany({ where: { userId } });
      await tx.capabilitySetting.deleteMany({ where: { userId } });
      await tx.recommendation.deleteMany({ where: { userId } });
      await tx.advisorInsight.deleteMany({ where: { userId } });
      await tx.savedPayoffPlan.deleteMany({ where: { userId } });
      await tx.aICorrection.deleteMany({ where: { userId } });
      await tx.handoffSummary.deleteMany({ where: { userId } });
      await tx.readinessScoreChange.deleteMany({ where: { snapshot: { userId } } });
      await tx.readinessSignal.deleteMany({ where: { userId } });
      await tx.readinessObservation.deleteMany({ where: { userId } });
      await tx.readinessSnapshot.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      // Connections hold deployment-encrypted credentials and are intentionally
      // not part of a per-user backup. Clear their links before replacing accounts.
      await tx.linkedBankAccount.deleteMany({ where: { connection: { userId } } });
      await tx.bankConnection.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.userSettings.deleteMany({ where: { userId } });

      // Re-insert data
      if (payload.accounts?.length) {
        await tx.account.createMany({ data: payload.accounts });
      }
      if (payload.cashflowEvents?.length) {
        await tx.cashflowEvent.createMany({ data: payload.cashflowEvents });
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
      if (payload.financialGoals?.length) {
        await tx.financialGoal.createMany({ data: payload.financialGoals });
      }
      if (payload.vehicles?.length) {
        await tx.vehicle.createMany({ data: payload.vehicles });
      }
      if (payload.vehicleMaintenance?.length) {
        await tx.vehicleMaintenance.createMany({ data: payload.vehicleMaintenance });
      }
      if (payload.homeAssets?.length) {
        await tx.homeAsset.createMany({ data: payload.homeAssets });
      }
      if (payload.homeMaintenanceTasks?.length) {
        await tx.homeMaintenanceTask.createMany({ data: payload.homeMaintenanceTasks });
      }
      if (payload.emergencyPreparednessItems?.length) {
        await tx.emergencyPreparednessItem.createMany({ data: payload.emergencyPreparednessItems });
      }
      if (payload.householdTransitionPlans?.length) {
        await tx.householdTransitionPlan.createMany({ data: payload.householdTransitionPlans });
      }
      if (payload.householdTransitionContacts?.length) {
        await tx.householdTransitionContact.createMany({
          data: payload.householdTransitionContacts,
        });
      }
      if (payload.investmentHoldings?.length) {
        await tx.investmentHolding.createMany({ data: payload.investmentHoldings });
      }
      if (payload.investmentQuoteSnapshots?.length) {
        await tx.investmentQuoteSnapshot.createMany({ data: payload.investmentQuoteSnapshots });
      }
      if (payload.realEstateProfiles?.length) {
        await tx.realEstateProfile.createMany({ data: payload.realEstateProfiles });
      }
      if (payload.debtProfiles?.length) {
        await tx.debtProfile.createMany({ data: payload.debtProfiles });
      }
      if (payload.insurancePolicies?.length) {
        await tx.insurancePolicy.createMany({ data: payload.insurancePolicies });
      }
      if (payload.estateDocuments?.length) {
        await tx.estateDocument.createMany({ data: payload.estateDocuments });
      }
      if (payload.incomeSources?.length) {
        await tx.incomeSource.createMany({ data: payload.incomeSources });
      }
      if (payload.dependents?.length) {
        await tx.dependent.createMany({ data: payload.dependents });
      }
      if (payload.householdObligations?.length) {
        await tx.householdObligation.createMany({ data: payload.householdObligations });
      }
      if (payload.plannedExpenses?.length) {
        await tx.plannedExpense.createMany({ data: payload.plannedExpenses });
      }
      if (payload.capabilitySettings?.length) {
        await tx.capabilitySetting.createMany({ data: payload.capabilitySettings });
      }
      if (payload.recommendations?.length) {
        await tx.recommendation.createMany({ data: payload.recommendations });
      }
      if (payload.advisorInsights?.length) {
        await tx.advisorInsight.createMany({ data: payload.advisorInsights });
      }
      if (payload.savedPayoffPlans?.length) {
        await tx.savedPayoffPlan.createMany({ data: payload.savedPayoffPlans });
      }
      if (payload.aiCorrections?.length) {
        await tx.aICorrection.createMany({ data: payload.aiCorrections });
      }
      if (payload.handoffSummaries?.length) {
        await tx.handoffSummary.createMany({ data: payload.handoffSummaries });
      }
      if (payload.readinessSnapshots?.length) {
        await tx.readinessSnapshot.createMany({ data: payload.readinessSnapshots });
      }
      if (payload.readinessObservations?.length) {
        await tx.readinessObservation.createMany({ data: payload.readinessObservations });
      }
      if (payload.readinessSignals?.length) {
        await tx.readinessSignal.createMany({ data: payload.readinessSignals });
      }
      if (payload.readinessScoreChanges?.length) {
        await tx.readinessScoreChange.createMany({ data: payload.readinessScoreChanges });
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
        isAutomated: true,
        createdAt: true,
      },
    });

    return backups.map((b) => ({
      id: b.id,
      filename: b.filename,
      size: Number(b.size),
      isAutomated: b.isAutomated,
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

      await Promise.all(
        idsToDelete.map((id) => unlink(this.backupPath(id)).catch(() => undefined)),
      );
    }
  }

  private backupPath(backupId: string): string {
    return join(backupDirectory(), `${backupId}.enc`);
  }

  private async writeBackup(backupId: string, packed: Buffer): Promise<void> {
    await mkdir(backupDirectory(), { recursive: true });
    await writeFile(this.backupPath(backupId), packed, { mode: 0o600 });
  }

  private isScheduleDue(
    schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null,
    lastRunAt: Date | null,
    now: Date,
  ): boolean {
    if (!schedule || !lastRunAt) return Boolean(schedule);
    const dueAt = new Date(lastRunAt);
    if (schedule === 'DAILY') dueAt.setUTCDate(dueAt.getUTCDate() + 1);
    if (schedule === 'WEEKLY') dueAt.setUTCDate(dueAt.getUTCDate() + 7);
    if (schedule === 'MONTHLY') dueAt.setUTCMonth(dueAt.getUTCMonth() + 1);
    return now >= dueAt;
  }

  private async scheduledBackupKey(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { scheduledBackupKey: true },
    });
    if (!settings?.scheduledBackupKey) {
      throw new NotFoundException('Automatic backup key not found');
    }
    return this.encryption.decrypt(settings.scheduledBackupKey);
  }
}
