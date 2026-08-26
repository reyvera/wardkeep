import { Injectable } from '@nestjs/common';

import { ReadinessService } from '../readiness/readiness.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { TimelineEvent, TimelineService } from '../timeline/timeline.service';

export interface MorningBrief {
  greeting: string;
  readiness: { score: number | null; state: 'known' | 'partial' | 'not_evaluated'; coverage: number };
  priority: { summary: string; action: string; href: string } | null;
  currentRisk: string | null;
  upcoming: TimelineEvent[];
}

@Injectable()
export class AdvisorService {
  constructor(
    private readonly readiness: ReadinessService,
    private readonly recommendations: RecommendationsService,
    private readonly timeline: TimelineService,
  ) {}

  /** Builds a deterministic morning brief from recorded readiness and timeline data. */
  async getMorningBrief(userId: string): Promise<MorningBrief> {
    const readiness = await this.readiness.getReadiness(userId);
    await this.recommendations.synchronize(userId, readiness.signals);
    const [recommendations, upcoming] = await Promise.all([
      this.recommendations.list(userId),
      this.timeline.listUpcoming(userId, 7),
    ]);
    const recommendation = recommendations.find((candidate) => candidate.status === 'ACTIVE') ?? null;
    const currentRisk = readiness.topRisks[0]?.summary ?? null;

    return {
      greeting: 'Good morning',
      readiness: {
        score: readiness.overallAssessment.score,
        state: readiness.overallAssessment.state,
        coverage: readiness.overallAssessment.coverage,
      },
      priority: recommendation
        ? {
            summary: recommendation.signalSummary,
            action: recommendation.action,
            href: recommendation.actionHref,
          }
        : null,
      currentRisk,
      upcoming,
    };
  }
}
