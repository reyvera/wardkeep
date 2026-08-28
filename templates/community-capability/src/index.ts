import type {
  Capability,
  CapabilityContext,
  CapabilityMetadata,
  DashboardCard,
  Observation,
  Recommendation,
  Signal,
  TimelineEvent,
} from '@wardkeep/capability-sdk';

export const metadata: CapabilityMetadata = {
  id: 'garden',
  name: 'Garden',
  pillars: ['preparation'],
  icon: 'leaf',
  description: 'Seasonal household garden planning.',
  source: 'community',
};

export class GardenCapability implements Capability {
  readonly metadata = metadata;

  observations(_context: CapabilityContext): Observation[] { return []; }
  signals(_context: CapabilityContext): Signal[] { return []; }
  recommendations(_context: CapabilityContext): Recommendation[] { return []; }
  dashboardCards(_context: CapabilityContext): DashboardCard[] { return []; }
  timelineEvents(_context: CapabilityContext): TimelineEvent[] { return []; }
}
