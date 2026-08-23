import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { InsuranceService } from './insurance.service';

describe('InsuranceService payment safeguards', () => {
  const userId = 'user-1';

  it('requires a linked account for a bundled premium', async () => {
    const prisma = {} as PrismaService;
    const service = new InsuranceService(prisma);

    await expect(
      service.create(userId, {
        type: 'HOME',
        provider: 'Example Mutual',
        paymentArrangement: 'MORTGAGE_ESCROW',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects property-tax escrow unless the policy is paid through mortgage escrow', async () => {
    const prisma = {} as PrismaService;
    const service = new InsuranceService(prisma);

    await expect(
      service.create(userId, {
        type: 'HOME',
        provider: 'Example Mutual',
        propertyTaxEscrow: '400.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not link a bundled payment account owned by another household', async () => {
    const prisma = {
      account: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new InsuranceService(prisma);

    await expect(
      service.create(userId, {
        type: 'AUTO',
        provider: 'Example Mutual',
        paymentArrangement: 'LOAN_OR_LEASE',
        paymentAccountId: 'a0f8aefe-e5ef-48a0-a65a-44b1cf92a0cb',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
