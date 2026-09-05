import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackupService } from './backup.service';
import { EncryptionService } from '../common/services/encryption.service';

type BackupServiceInternals = {
  encrypt(data: Buffer, passphrase: string): {
    encrypted: Buffer;
    iv: Buffer;
    salt: Buffer;
    authTag: Buffer;
  };
  writeBackup(backupId: string, packed: Buffer): Promise<void>;
  enforceRetention(userId: string): Promise<void>;
};

function internals(service: BackupService): BackupServiceInternals {
  return service as unknown as BackupServiceInternals;
}

function createService(prisma: unknown): BackupService {
  return new BackupService(prisma as never, new EncryptionService());
}

describe('BackupService local storage', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
    delete process.env['WARDKEEP_BACKUP_DIR'];
  });

  it('persists an encrypted payload for a new service instance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const id = '22222222-2222-4222-8222-222222222222';
    const payload = Buffer.from('encrypted bytes');

    await internals(createService({})).writeBackup(id, payload);
    const stored = await readFile(join(directory, `${id}.enc`));

    expect(stored).toEqual(payload);
  });

  it('loads a persisted file during restore after a service restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const id = '33333333-3333-4333-8333-333333333333';
    const writer = internals(createService({}));
    const encrypted = writer.encrypt(Buffer.from('{"accounts":[]}'), 'correct passphrase');
    await writer.writeBackup(
      id,
      Buffer.concat([encrypted.salt, encrypted.iv, encrypted.authTag, encrypted.encrypted]),
    );
    const prisma = {
      backup: { findFirst: async () => ({ id, userId: 'household-1' }) },
      $transaction: async () => {
        throw new Error('restore must not run with an invalid passphrase');
      },
    };

    await expect(
      createService(prisma).restoreBackup('household-1', id, 'wrong passphrase'),
    ).rejects.toMatchObject({ message: 'Invalid passphrase' });
  });

  it('restores an automatic backup of saved future cash-flow events without a passphrase', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const id = '66666666-6666-4666-8666-666666666666';
    const cashflowEvents = [{
      id: '77777777-7777-4777-8777-777777777777',
      userId: 'household-1',
      accountId: '88888888-8888-4888-8888-888888888888',
      date: '2026-09-20T12:00:00.000Z',
      amount: '1200.00',
      type: 'DEBIT',
      description: 'Roof repair deposit',
    }];
    const scheduledBackupKey = 'deployment-protected-backup-key';
    const writer = internals(createService({}));
    const encrypted = writer.encrypt(
      Buffer.from(JSON.stringify({ accounts: [], cashflowEvents })),
      scheduledBackupKey,
    );
    await writer.writeBackup(
      id,
      Buffer.concat([encrypted.salt, encrypted.iv, encrypted.authTag, encrypted.encrypted]),
    );

    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      transactionTag: { deleteMany }, transaction: { deleteMany },
      cashflowEvent: { deleteMany, createMany }, budgetAllocation: { deleteMany, createMany },
      budget: { deleteMany, createMany }, ruleCondition: { deleteMany, createMany },
      ruleAction: { deleteMany, createMany }, rule: { deleteMany, createMany },
      recurringTransaction: { deleteMany, createMany }, financialGoal: { deleteMany, createMany },
      vehicleMaintenance: { deleteMany, createMany }, vehicle: { deleteMany, createMany },
      homeMaintenanceTask: { deleteMany, createMany }, homeAsset: { deleteMany, createMany },
      emergencyPreparednessItem: { deleteMany, createMany },
      householdTransitionPlan: { deleteMany, createMany }, category: { deleteMany, createMany },
      account: { deleteMany, createMany }, userSettings: { deleteMany, create: vi.fn() },
    };
    const prisma = {
      backup: { findFirst: vi.fn().mockResolvedValue({ id, userId: 'household-1', isAutomated: true }) },
      userSettings: {
        findUnique: vi.fn().mockResolvedValue({
          scheduledBackupKey: new EncryptionService().encrypt(scheduledBackupKey),
        }),
      },
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    };

    await expect(
      createService(prisma).restoreBackup('household-1', id),
    ).resolves.toEqual({ message: 'Backup restored successfully' });

    expect(tx.cashflowEvent.deleteMany).toHaveBeenCalledWith({ where: { userId: 'household-1' } });
    expect(tx.cashflowEvent.createMany).toHaveBeenCalledWith({ data: cashflowEvents });
  });

  it('removes the encrypted file when retention expires a backup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const expiredId = '44444444-4444-4444-8444-444444444444';
    const retainedId = '55555555-5555-4555-8555-555555555555';
    const prisma = {
      userSettings: { findUnique: async () => ({ backupRetention: 1 }) },
      backup: {
        findMany: async () => [{ id: retainedId }, { id: expiredId }],
        deleteMany: async () => ({ count: 1 }),
      },
    };
    const service = internals(createService(prisma));
    await service.writeBackup(expiredId, Buffer.from('expired'));

    await service.enforceRetention('household-1');

    await expect(readFile(join(directory, `${expiredId}.enc`))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('runs only schedules that are due, including calendar-month schedules', async () => {
    const prisma = {
      userSettings: {
        findMany: async () => [
          { userId: 'daily', backupSchedule: 'DAILY', scheduledBackupLastRunAt: null },
          {
            userId: 'weekly-not-due',
            backupSchedule: 'WEEKLY',
            scheduledBackupLastRunAt: new Date('2026-09-01T04:00:00.000Z'),
          },
          {
            userId: 'monthly',
            backupSchedule: 'MONTHLY',
            scheduledBackupLastRunAt: new Date('2026-08-03T04:00:00.000Z'),
          },
        ],
      },
    };
    const service = createService(prisma);
    const createScheduledBackup = vi
      .spyOn(service, 'createScheduledBackup')
      .mockResolvedValue({} as never);

    await expect(service.runDueScheduledBackups(new Date('2026-09-03T04:00:00.000Z'))).resolves.toEqual({
      created: 2,
    });
    expect(createScheduledBackup).toHaveBeenCalledTimes(2);
    expect(createScheduledBackup).toHaveBeenCalledWith('daily');
    expect(createScheduledBackup).toHaveBeenCalledWith('monthly');
  });
});
