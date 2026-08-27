import { Decimal } from 'decimal.js'; import { describe, expect, it } from 'vitest'; import { leaseEndingSignal, plannedExpenseSignal, vehicleMaintenanceSignal } from './preparation.generator';
const now = new Date('2026-08-23T12:00:00.000Z');
describe('plannedExpenseSignal', () => { it('shows only the explicitly recorded shortfall', () => { const signal = plannedExpenseSignal({ name: 'Property tax', amount: new Decimal(1800), fundedAmount: new Decimal(600), dueDate: new Date('2026-09-10T00:00:00.000Z') }, now); expect(signal).toMatchObject({ magnitude: -3, pillar: 'preparation' }); expect(signal?.summary).toContain('$1200.00'); }); it('treats a fully funded record as positive progress', () => { const signal = plannedExpenseSignal({ name: 'Registration', amount: new Decimal(420), fundedAmount: new Decimal(420), dueDate: new Date('2026-09-01T00:00:00.000Z') }, now); expect(signal).toMatchObject({ type: 'positive', magnitude: 1 }); }); });

describe('vehicle preparation signals', () => {
  it('marks an explicitly overdue service reminder as a risk', () => {
    expect(vehicleMaintenanceSignal({ name: 'Oil change', dueDate: new Date('2026-08-20T00:00:00.000Z'), vehicle: { make: 'Honda', model: 'CR-V' } }, now)).toMatchObject({ capabilityId: 'vehicle-maintenance', type: 'risk', magnitude: -4 });
  });
  it('surfaces a recorded near-term lease end without inferring an asset value', () => {
    expect(leaseEndingSignal({ make: 'Tesla', model: 'Model 3', leaseEndDate: new Date('2026-09-15T00:00:00.000Z') }, now)).toMatchObject({ capabilityId: 'vehicle-lease', magnitude: -3, pillar: 'preparation' });
  });
});
