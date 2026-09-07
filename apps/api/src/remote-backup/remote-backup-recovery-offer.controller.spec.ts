import { BadRequestException } from '@nestjs/common';
import { once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import {
  RemoteBackupRecoveryOfferController,
  RemoteBackupRecoveryRedemptionController,
} from './remote-backup-recovery-offer.controller';

describe('RemoteBackupRecoveryOfferController', () => {
  it('uses the authenticated household and rejects malformed archive IDs', async () => {
    const create = vi.fn().mockResolvedValue({ offerId: 'offer-1' });
    const controller = new RemoteBackupRecoveryOfferController({ create } as never);
    const id = '11111111-1111-4111-8111-111111111111';
    await expect(controller.create({ userId: 'household-1' } as never, id)).resolves.toEqual({
      offerId: 'offer-1',
    });
    expect(create).toHaveBeenCalledWith('household-1', id);
    expect(() => controller.create({ userId: 'household-1' } as never, 'bad-id')).toThrow(
      BadRequestException,
    );
  });
});

describe('RemoteBackupRecoveryRedemptionController', () => {
  it('redeems an offer and streams only the archive authorized by its session', async () => {
    const offers = {
      redeem: vi.fn().mockResolvedValue({ sessionToken: 's'.repeat(43) }),
      consumeSession: vi.fn().mockResolvedValue('backup-1'),
    };
    const storage = {
      openForRecovery: vi.fn().mockResolvedValue({
        stream: Readable.from(Buffer.from('encrypted archive')),
        size: 17,
        checksum: 'c'.repeat(64),
      }),
    };
    const controller = new RemoteBackupRecoveryRedemptionController(offers as never, storage as never);
    const response = Object.assign(new PassThrough(), { set: vi.fn() });
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = once(response, 'end');

    await expect(controller.redeem({ offerId: '11111111-1111-4111-8111-111111111111', secret: 's'.repeat(43) })).resolves.toEqual({
      sessionToken: 's'.repeat(43),
    });
    await controller.download({ sessionToken: 's'.repeat(43) }, response as never);
    await finished;

    expect(offers.consumeSession).toHaveBeenCalledWith('s'.repeat(43));
    expect(storage.openForRecovery).toHaveBeenCalledWith('backup-1');
    expect(response.set).toHaveBeenCalledWith({
      'content-type': 'application/octet-stream',
      'content-length': '17',
      'x-wardkeep-content-sha256': 'c'.repeat(64),
    });
    expect(Buffer.concat(chunks).toString()).toBe('encrypted archive');
  });

  it('rejects malformed recovery credentials before accessing storage', async () => {
    const offers = { redeem: vi.fn(), consumeSession: vi.fn() };
    const controller = new RemoteBackupRecoveryRedemptionController(offers as never, {} as never);

    expect(() => controller.redeem({ offerId: 'bad', secret: 'short' })).toThrow(BadRequestException);
    await expect(controller.download({ sessionToken: 'short' }, {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(offers.consumeSession).not.toHaveBeenCalled();
  });
});
