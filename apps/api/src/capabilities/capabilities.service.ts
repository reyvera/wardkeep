import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityContext, CapabilityMetadata, CapabilityRegistry, DashboardCard, Observation, ReadinessPillar, Recommendation, Signal, TimelineEvent } from '@wardkeep/capability-sdk';

import { PrismaService } from '../prisma/prisma.service';
import { FinanceCapability, financeCapabilityMetadata } from './finance.capability';

class RegisteredCoreCapability implements Capability {
  constructor(readonly metadata: CapabilityMetadata) {}

  observations(_context: CapabilityContext): Observation[] { return []; }
  signals(_context: CapabilityContext): Signal[] { return []; }
  recommendations(_context: CapabilityContext): Recommendation[] { return []; }
  dashboardCards(_context: CapabilityContext): DashboardCard[] { return []; }
  timelineEvents(_context: CapabilityContext): TimelineEvent[] { return []; }
}

const coreCapabilities: CapabilityMetadata[] = [
  financeCapabilityMetadata,
  { id: 'vehicle', name: 'Vehicles', pillars: ['preparation', 'prosperity'], icon: 'car', description: 'Vehicle ownership, values, leases, and maintenance planning.', source: 'core' },
  { id: 'insurance', name: 'Insurance', pillars: ['protection'], icon: 'shield', description: 'Policies, renewals, deductibles, and coverage gaps.', source: 'core' },
  { id: 'home', name: 'Home maintenance', pillars: ['preparation'], icon: 'home', description: 'Home assets, maintenance work, and replacement planning.', source: 'core' },
  { id: 'estate', name: 'Estate planning', pillars: ['protection'], icon: 'file-text', description: 'Recorded estate documents and review reminders.', source: 'core' },
  { id: 'emergency-preparedness', name: 'Emergency preparedness', pillars: ['protection', 'preparation'], icon: 'alert-triangle', description: 'A practical household preparedness checklist.', source: 'core' },
  { id: 'household-transitions', name: 'Household continuity', pillars: ['peace', 'preparation'], icon: 'heart-handshake', description: 'Neutral plans for household continuity and periodic review.', source: 'core' },
];

/** Maps existing published signal IDs to the core capability that owns them. */
const signalCapabilityOwners: Record<string, string> = {
  accounts: 'finance', budgets: 'finance', cashflow: 'finance', debt: 'finance', dependents: 'finance',
  'emergency-fund': 'finance', 'fixed-obligations': 'finance', 'income-sources': 'finance',
  'planned-expenses': 'finance', recurring: 'finance', 'secondary-liquidity': 'finance',
  'vehicle-lease': 'vehicle', 'vehicle-maintenance': 'vehicle',
  'insurance-coverage-target': 'insurance', 'insurance-deductibles': 'insurance', 'insurance-record-details': 'insurance',
  'estate-documents': 'estate', 'home-assets': 'home',
};

@Injectable()
export class CapabilitiesService implements CapabilityRegistry, OnModuleInit {
  private readonly registered = new Map<string, Capability>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeCapability: FinanceCapability,
  ) {}

  onModuleInit(): void {
    for (const metadata of coreCapabilities) {
      this.register(metadata.id === 'finance' ? this.financeCapability : new RegisteredCoreCapability(metadata));
    }
  }

  register(capability: Capability): void { this.registered.set(capability.metadata.id, capability); }
  all(): Capability[] { return [...this.registered.values()]; }
  byPillar(pillar: ReadinessPillar): Capability[] { return this.all().filter(({ metadata }) => metadata.pillars.includes(pillar)); }
  get(id: string): Capability | undefined { return this.registered.get(id); }

  async listForUser(userId: string) {
    const settings = await this.prisma.capabilitySetting.findMany({ where: { userId } });
    const enabledById = new Map(settings.map((setting) => [setting.capabilityId, setting.isEnabled]));
    return this.all().map(({ metadata }) => ({ ...metadata, isEnabled: enabledById.get(metadata.id) ?? true }));
  }

  async enabledForUser(userId: string): Promise<Capability[]> {
    const settings = await this.listForUser(userId);
    return settings.filter((setting) => setting.isEnabled).flatMap((setting) => {
      const capability = this.get(setting.id);
      return capability ? [capability] : [];
    });
  }

  async enable(userId: string, capabilityId: string) { return this.setEnabled(userId, capabilityId, true); }
  async disable(userId: string, capabilityId: string) { return this.setEnabled(userId, capabilityId, false); }

  /**
   * The readiness engine receives only the signals a household has opted into.
   * This is the cross-capability boundary: raw records remain inside their
   * owning service, while downstream consumers operate on published signals.
   */
  async publishedSignalsForUser<T extends { capabilityId: string }>(userId: string, signals: T[]): Promise<T[]> {
    const capabilities = await this.listForUser(userId);
    const enabled = new Map(capabilities.map((capability) => [capability.id, capability.isEnabled]));
    return signals.filter((signal) => enabled.get(signalCapabilityOwners[signal.capabilityId] ?? signal.capabilityId) !== false);
  }

  private async setEnabled(userId: string, capabilityId: string, isEnabled: boolean) {
    const capability = this.get(capabilityId);
    if (!capability) throw new NotFoundException('Capability not found');
    const setting = await this.prisma.capabilitySetting.upsert({
      where: { userId_capabilityId: { userId, capabilityId } },
      create: { userId, capabilityId, isEnabled },
      update: { isEnabled },
    });
    return { ...capability.metadata, isEnabled: setting.isEnabled };
  }
}
