import { Controller, Get, Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(HealthController.name);

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
    } catch (error) {
      this.logger.error(
        'Health check database error',
        error instanceof Error ? error.stack : undefined,
      );
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
