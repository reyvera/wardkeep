import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap the NestJS application with security middleware and global configuration.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
}

bootstrap();
