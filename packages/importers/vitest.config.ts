import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@wardkeep/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
