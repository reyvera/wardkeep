import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: 'up' | 'down';
  };
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns application health status including database connectivity.
   * @returns Health check response with service statuses
   */
  @Get()
  async check(): Promise<HealthResponse> {
    let databaseStatus: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'up';
    } catch {
      databaseStatus = 'down';
    }

    return {
      status: databaseStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
      },
    };
  }
}
