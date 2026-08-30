import { describe, expect, it, vi } from 'vitest';
import { RecurringService } from './recurring.service';

describe('RecurringService cancellation checks', () => {
  it('flags a matching charge recorded after cancellation', async () => {
    const cancelledAt = new Date('2026-08-01');
    const prisma = { recurringTransaction: { findMany: vi.fn().mockResolvedValue([{ id: 'recurring', userId: 'user', accountId: 'account', merchant: 'StreamCo', expectedAmount: { toString: () => '12.99' }, frequency: 'MONTHLY', nextExpected: new Date('2026-09-01'), isConfirmed: true, isDismissed: false, isActive: true, isSubscription: true, cancelledAt, createdAt: new Date() }]) }, transaction: { findMany: vi.fn().mockResolvedValue([{ merchant: 'StreamCo', date: new Date('2026-08-15') }]) } };
    const result = await new RecurringService(prisma as never).listConfirmed('user');
    expect(result[0].chargeAfterCancellation).toBe(true);
  });
});
