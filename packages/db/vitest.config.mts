import { defineConfig } from 'vitest/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load root .env or package .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure database URL fallback is defined for test runtime
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/compass_analytics';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
    },
  },
});
