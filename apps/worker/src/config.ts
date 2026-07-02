/**
 * Worker configuration loaded from environment variables.
 */

export const redisConfig = {
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
};

export const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wardkeep';
