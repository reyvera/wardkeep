import { describe, expect, it, vi } from 'vitest';
import { RealEstateService } from './real-estate.service';

describe('RealEstateService', () => {
  it('calculates equity from the current manual mortgage balance', async () => {
    const prisma = {
      realEstateProfile: { findFirst: vi.fn().mockResolvedValue({ recordedValue: '500000', valuationDate: new Date('2026-08-01'), mortgageAccountId: 'mortgage-1' }) },
      account: { findFirst: vi.fn().mockResolvedValue({ initialBalance: '400000', linkedBankAccounts: [], transactions: [{ amount: '10000', type: 'CREDIT', aiConfidence: null }] }) },
    } as never;
    await expect(new RealEstateService(prisma).equity('user-1', 'home-1')).resolves.toMatchObject({
      mortgageBalance: '410000.00',
      equity: '90000.00',
    });
  });

  it('removes only a property profile owned by the household', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      realEstateProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'profile-1' }), delete: remove },
    } as never;
    await new RealEstateService(prisma).remove('user-1', 'home-1');
    expect(remove).toHaveBeenCalledWith({ where: { id: 'profile-1' } });
  });
});
