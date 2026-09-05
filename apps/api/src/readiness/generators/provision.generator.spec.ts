import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import {
  budgetPaceSignals,
  cashFlowProjectionSignal,
  generateProvisionSignals,
} from './provision.generator';

describe('finance provision thresholds', () => {
  it('flags recorded spending at 95% of the monthly budget as a bounded risk', () => {
    const signals = budgetPaceSignals(
      new Decimal(1_000),
      new Decimal(950),
      0,
      new Date('2026-08-10T12:00:00.000Z'),
    );

    expect(signals).toContainEqual(expect.objectContaining({
      capabilityId: 'budgets', type: 'risk', magnitude: -5,
    }));
  });

  it('flags a cash-flow projection that goes negative within 14 days', () => {
    // The 14-day occurrence is a subset of the published 30-day projection window.
    const signal = cashFlowProjectionSignal(1);

    expect(signal).toMatchObject({ capabilityId: 'cashflow', type: 'risk', magnitude: -8 });
    expect(signal.magnitude).toBeGreaterThanOrEqual(-10);
    expect(signal.magnitude).toBeLessThanOrEqual(10);
  });

  it('includes saved one-time events in the deterministic cash-flow readiness projection', async () => {
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 1);

    const prisma = {
      budget: { findUnique: vi.fn().mockResolvedValue(null) },
      account: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'checking-1',
          name: 'Checking',
          type: 'CHECKING',
          initialBalance: new Decimal(100),
          transactions: [],
          linkedBankAccounts: [],
        }]),
      },
      recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      cashflowEvent: {
        findMany: vi.fn().mockResolvedValue([{
          accountId: 'checking-1',
          date: eventDate,
          amount: new Decimal(200),
          type: 'DEBIT',
          description: 'Vehicle repair',
        }]),
      },
    };

    const signals = await generateProvisionSignals(prisma as never, 'user-1');

    expect(signals).toContainEqual(expect.objectContaining({
      capabilityId: 'cashflow', type: 'risk', magnitude: -8,
    }));
  });
});
