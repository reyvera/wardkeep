import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from monorepo root
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { createCorsOptions } from './common/config/cors';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap the NestJS application with security middleware and global configuration.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    next();
  });
  app.enableCors(createCorsOptions());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
}

bootstrap();
