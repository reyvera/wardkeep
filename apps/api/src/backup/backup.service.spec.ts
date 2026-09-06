import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackupService } from './backup.service';
import { EncryptionService } from '../common/services/encryption.service';
import { NotFoundException } from '@nestjs/common';

type BackupServiceInternals = {
  encrypt(
    data: Buffer,
    passphrase: string,
  ): {
    encrypted: Buffer;
    iv: Buffer;
    salt: Buffer;
    authTag: Buffer;
  };
  decrypt(encrypted: Buffer, passphrase: string, iv: Buffer, salt: Buffer, authTag: Buffer): Buffer;
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

  it('includes readiness and household-protection records in a new encrypted backup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const userId = 'household-1';
    const backupId = '11111111-1111-4111-8111-111111111111';
    const insurancePolicies = [{ id: 'policy-1', userId, provider: 'Wardkeep Mutual' }];
    const investmentHoldings = [{ id: 'holding-1', accountId: 'account-1', symbol: 'WK' }];
    const readinessSnapshots = [{ id: 'snapshot-1', userId, overall: 72 }];
    const capabilitySettings = [{ id: 'capability-1', userId, capabilityId: 'insurance' }];
    const collections: Record<string, unknown[]> = {
      insurancePolicy: insurancePolicies,
      investmentHolding: investmentHoldings,
      readinessSnapshot: readinessSnapshots,
      capabilitySetting: capabilitySettings,
    };
    const prisma = new Proxy(
      {
        backup: {
          create: vi.fn().mockResolvedValue({
            id: backupId,
            filename: 'backup.enc',
            size: BigInt(1),
            createdAt: new Date('2026-09-05T00:00:00.000Z'),
          }),
          findMany: vi.fn().mockResolvedValue([{ id: backupId }]),
          deleteMany: vi.fn(),
        },
        userSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      } as Record<string, unknown>,
      {
        get(target, property) {
          if (property in target) return target[property as string];
          return { findMany: vi.fn().mockResolvedValue(collections[property as string] ?? []) };
        },
      },
    );

    await createService(prisma).createBackup(userId, 'correct passphrase');

    const packed = await readFile(join(directory, `${backupId}.enc`));
    const decrypted = internals(createService({})).decrypt(
      packed.subarray(64),
      'correct passphrase',
      packed.subarray(32, 48),
      packed.subarray(0, 32),
      packed.subarray(48, 64),
    );
    const payload = JSON.parse(decrypted.toString('utf-8'));

    expect(payload.insurancePolicies).toEqual(insurancePolicies);
    expect(payload.investmentHoldings).toEqual(investmentHoldings);
    expect(payload.readinessSnapshots).toEqual(readinessSnapshots);
    expect(payload.capabilitySettings).toEqual(capabilitySettings);
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

  it('rejects another household’s backup before it reads or restores data', async () => {
    const prisma = {
      backup: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    };

    await expect(
      createService(prisma).restoreBackup(
        'household-1',
        '99999999-9999-4999-8999-999999999999',
        'correct passphrase',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('restores an automatic backup of saved future cash-flow events without a passphrase', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_BACKUP_DIR'] = directory;
    const id = '66666666-6666-4666-8666-666666666666';
    const cashflowEvents = [
      {
        id: '77777777-7777-4777-8777-777777777777',
        userId: 'household-1',
        accountId: '88888888-8888-4888-8888-888888888888',
        date: '2026-09-20T12:00:00.000Z',
        amount: '1200.00',
        type: 'DEBIT',
        description: 'Roof repair deposit',
        isActive: false,
        completedAt: '2026-09-21T12:00:00.000Z',
      },
      {
        id: '99999999-9999-4999-8999-999999999999',
        userId: 'household-1',
        accountId: '88888888-8888-4888-8888-888888888888',
        date: '2026-10-01T12:00:00.000Z',
        amount: '90.00',
        type: 'DEBIT',
        description: 'Older backup event',
      },
    ];
    const insurancePolicies = [
      {
        id: '10000000-0000-4000-8000-000000000001',
        userId: 'household-1',
        type: 'HOME',
        provider: 'Wardkeep Mutual',
        premiumFrequency: 'ANNUAL',
        paymentArrangement: 'SEPARATE',
        isActive: true,
      },
    ];
    const capabilitySettings = [
      {
        id: '10000000-0000-4000-8000-000000000002',
        userId: 'household-1',
        capabilityId: 'emergency-preparedness',
        isEnabled: true,
      },
    ];
    const readinessSnapshots = [
      {
        id: '10000000-0000-4000-8000-000000000003',
        userId: 'household-1',
        overall: 72,
        protection: 70,
        provision: 75,
        preparation: 0,
        prosperity: 71,
        peace: 72,
        recordedAt: '2026-09-01T00:00:00.000Z',
        modelVersion: 2,
      },
    ];
    const readinessSignals = [
      {
        id: '10000000-0000-4000-8000-000000000004',
        userId: 'household-1',
        capabilityId: 'insurance',
        type: 'POSITIVE',
        magnitude: 2,
        pillar: 'PROTECTION',
        summary: 'Insurance information is recorded.',
        weight: '1.00',
        snapshotId: readinessSnapshots[0].id,
      },
    ];
    const scheduledBackupKey = 'deployment-protected-backup-key';
    const writer = internals(createService({}));
    const encrypted = writer.encrypt(
      Buffer.from(
        JSON.stringify({
          accounts: [],
          cashflowEvents,
          insurancePolicies,
          capabilitySettings,
          readinessSnapshots,
          readinessSignals,
        }),
      ),
      scheduledBackupKey,
    );
    await writer.writeBackup(
      id,
      Buffer.concat([encrypted.salt, encrypted.iv, encrypted.authTag, encrypted.encrypted]),
    );

    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const txMethods = { deleteMany, createMany, create: vi.fn() };
    const tx = new Proxy({} as Record<string, typeof txMethods>, {
      get: () => txMethods,
    });
    const prisma = {
      backup: {
        findFirst: vi.fn().mockResolvedValue({ id, userId: 'household-1', isAutomated: true }),
      },
      userSettings: {
        findUnique: vi.fn().mockResolvedValue({
          scheduledBackupKey: new EncryptionService().encrypt(scheduledBackupKey),
        }),
      },
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    };

    await expect(createService(prisma).restoreBackup('household-1', id)).resolves.toEqual({
      message: 'Backup restored successfully',
    });

    expect(tx.cashflowEvent.deleteMany).toHaveBeenCalledWith({ where: { userId: 'household-1' } });
    expect(tx.cashflowEvent.createMany).toHaveBeenCalledWith({ data: cashflowEvents });
    expect(tx.insurancePolicy.createMany).toHaveBeenCalledWith({ data: insurancePolicies });
    expect(tx.capabilitySetting.createMany).toHaveBeenCalledWith({ data: capabilitySettings });
    expect(tx.readinessSnapshot.createMany).toHaveBeenCalledWith({ data: readinessSnapshots });
    expect(tx.readinessSignal.createMany).toHaveBeenCalledWith({ data: readinessSignals });
    expect(tx.linkedBankAccount.deleteMany).toHaveBeenCalledWith({
      where: { connection: { userId: 'household-1' } },
    });
    expect(tx.bankConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: 'household-1' } });
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

    await expect(
      service.runDueScheduledBackups(new Date('2026-09-03T04:00:00.000Z')),
    ).resolves.toEqual({
      created: 2,
    });
    expect(createScheduledBackup).toHaveBeenCalledTimes(2);
    expect(createScheduledBackup).toHaveBeenCalledWith('daily');
    expect(createScheduledBackup).toHaveBeenCalledWith('monthly');
  });
});
