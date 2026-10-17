import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.test', quiet: true });

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      NODE_ENV: process.env.NODE_ENV ?? 'test',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
      JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '900',
      JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '604800',
    },
  },
});
