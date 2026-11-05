import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env or package .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Provide safe defaults if unset so test runners never crash on Prisma or Clerk initialization
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://compass_app:compass_secret@localhost:5432/compass_analytics?sslmode=disable';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.AUTH_MODE = process.env.AUTH_MODE || 'dev';
process.env.NEXT_PUBLIC_AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'dev';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_ci_mock';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_ci_mock';
process.env.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || 'whsec_ci_mock';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      REDIS_URL: process.env.REDIS_URL,
      AUTH_MODE: process.env.AUTH_MODE,
      NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
