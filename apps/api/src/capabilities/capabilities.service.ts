import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityMetadata, CapabilityRegistry, DashboardCard, Observation, ReadinessPillar, Recommendation, Signal, TimelineEvent } from '@wardkeep/capability-sdk';

import { PrismaService } from '../prisma/prisma.service';

class RegisteredCoreCapability implements Capability {
  constructor(readonly metadata: CapabilityMetadata) {}

  observations(): Observation[] { return []; }
  signals(): Signal[] { return []; }
  recommendations(): Recommendation[] { return []; }
  dashboardCards(): DashboardCard[] { return []; }
  timelineEvents(): TimelineEvent[] { return []; }
}

const coreCapabilities: CapabilityMetadata[] = [
  { id: 'finance', name: 'Finance', pillars: ['provision', 'prosperity'], icon: 'wallet', description: 'Accounts, transactions, budgets, debt, cash flow, and savings goals.', source: 'core' },
  { id: 'vehicle', name: 'Vehicles', pillars: ['preparation', 'prosperity'], icon: 'car', description: 'Vehicle ownership, values, leases, and maintenance planning.', source: 'core' },
  { id: 'insurance', name: 'Insurance', pillars: ['protection'], icon: 'shield', description: 'Policies, renewals, deductibles, and coverage gaps.', source: 'core' },
  { id: 'home', name: 'Home maintenance', pillars: ['preparation'], icon: 'home', description: 'Home assets, maintenance work, and replacement planning.', source: 'core' },
  { id: 'estate', name: 'Estate planning', pillars: ['protection'], icon: 'file-text', description: 'Recorded estate documents and review reminders.', source: 'core' },
  { id: 'emergency-preparedness', name: 'Emergency preparedness', pillars: ['protection', 'preparation'], icon: 'alert-triangle', description: 'A practical household preparedness checklist.', source: 'core' },
  { id: 'household-transitions', name: 'Household continuity', pillars: ['peace', 'preparation'], icon: 'heart-handshake', description: 'Neutral plans for household continuity and periodic review.', source: 'core' },
];

@Injectable()
export class CapabilitiesService implements CapabilityRegistry, OnModuleInit {
  private readonly registered = new Map<string, Capability>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    for (const metadata of coreCapabilities) this.register(new RegisteredCoreCapability(metadata));
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

  async enable(userId: string, capabilityId: string) { return this.setEnabled(userId, capabilityId, true); }
  async disable(userId: string, capabilityId: string) { return this.setEnabled(userId, capabilityId, false); }

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
