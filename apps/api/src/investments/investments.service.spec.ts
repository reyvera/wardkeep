import { describe, expect, it, vi } from 'vitest';
import { InvestmentsService } from './investments.service';

describe('InvestmentsService', () => {
  it('creates holdings only in the user’s eligible active investment account', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'holding-1' });
    const prisma = {
      account: { findFirst: vi.fn().mockResolvedValue({ id: 'account-1' }) },
      investmentHolding: { create },
    } as never;
    await expect(
      new InvestmentsService(prisma).create('user-1', {
        accountId: 'account-1',
        symbol: 'aapl',
        quantity: '2',
        costBasis: '300',
      }),
    ).resolves.toEqual({ id: 'holding-1' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ symbol: 'AAPL' }) }),
    );
  });

  it('records a dated factual quote only for a holding owned by the user', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'holding-1' });
    const prisma = {
      investmentHolding: { findFirst: vi.fn().mockResolvedValue({ id: 'holding-1' }), update },
      $transaction: vi.fn(async (callback) => callback({
        investmentHolding: { update },
        investmentQuoteSnapshot: {
          create: vi.fn().mockResolvedValue({ id: 'quote-1' }),
          findFirst: vi.fn().mockResolvedValue({ price: '321.45', source: 'Statement', asOf: new Date('2026-08-31') }),
        },
      })),
    } as never;
    await new InvestmentsService(prisma).recordQuote('user-1', 'holding-1', {
      quotePrice: '321.45', quoteSource: 'Statement', quoteAsOf: '2026-08-31',
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quotePrice: expect.anything(), quoteSource: 'Statement' }),
    }));
  });

  it('keeps the newest dated snapshot as the current quote when an older quote is backfilled', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'holding-1' });
    const prisma = {
      investmentHolding: { findFirst: vi.fn().mockResolvedValue({ id: 'holding-1' }) },
      $transaction: vi.fn(async (callback) => callback({
        investmentHolding: { update },
        investmentQuoteSnapshot: {
          create: vi.fn().mockResolvedValue({ id: 'quote-2' }),
          findFirst: vi.fn().mockResolvedValue({ price: '400', source: 'Earlier statement', asOf: new Date('2026-08-31') }),
        },
      })),
    } as never;

    await new InvestmentsService(prisma).recordQuote('user-1', 'holding-1', {
      quotePrice: '300', quoteSource: 'Backfill', quoteAsOf: '2026-08-01',
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quotePrice: expect.anything(), quoteSource: 'Earlier statement' }),
    }));
  });

  it('updates quantity and permits clearing an optional cost basis for an owned holding', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'holding-1' });
    const prisma = {
      investmentHolding: { findFirst: vi.fn().mockResolvedValue({ id: 'holding-1' }), update },
    } as never;
    await new InvestmentsService(prisma).update('user-1', 'holding-1', { quantity: '4.25', costBasis: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ costBasis: null }),
    }));
  });
});
