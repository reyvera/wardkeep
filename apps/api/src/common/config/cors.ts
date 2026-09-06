/**
 * Resolve the browser origins allowed to call the API. Internal callers such
 * as the worker do not send an Origin header and are handled separately.
 */
export function resolveCorsOrigins(value = process.env['CORS_ORIGINS']): string[] {
  const configured = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length
    ? [...new Set(configured)]
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

/**
 * CORS policy for browser callers. Requests without an Origin header are
 * non-browser clients (health checks, workers, and CLI tools) and do not need
 * browser cross-origin permission.
 */
export function createCorsOptions(origins = resolveCorsOrigins()) {
  const allowedOrigins = new Set(origins);

  return {
    credentials: true,
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin is not allowed by CORS: ${origin}`));
    },
  };
}
