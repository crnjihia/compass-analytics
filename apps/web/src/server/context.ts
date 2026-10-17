import { auth } from '@clerk/nextjs/server';
import { prisma, createTenantDb, type TenantScopedPrismaClient } from '@compass/db';
import { redis } from '../lib/redis';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type Redis from 'ioredis';

export type UserRole = 'org:admin' | 'org:member';

export interface Context {
  userId: string | null;
  orgId: string | null;
  role: UserRole | null;
  db: TenantScopedPrismaClient | null;
  redis: Redis;
}

/**
 * Creates the tRPC context for Next.js App Router / route handlers.
 * Extracts session credentials from Clerk (or mock headers in non-production tests)
 * and scopes the database client to the active tenant.
 */
export async function createContext(opts?: FetchCreateContextFnOptions): Promise<Context> {
  let userId: string | null = null;
  let orgId: string | null = null;
  let role: UserRole | null = null;

  // 1. Check for testing/mock headers in non-production environments
  if (process.env.NODE_ENV !== 'production' && opts?.req) {
    const mockUserId = opts.req.headers.get('x-mock-user-id');
    const mockOrgId = opts.req.headers.get('x-mock-org-id');
    const mockRole = opts.req.headers.get('x-mock-role') as UserRole | null;

    if (mockUserId) {
      userId = mockUserId;
      orgId = mockOrgId || null;
      role = mockRole || 'org:member';
    }
  }

  // 2. Resolve from Clerk session if not set by test mock
  if (!userId) {
    try {
      const session = await auth();
      userId = session.userId || null;
      orgId = session.orgId || null;
      role = (session.orgRole as UserRole) || null;
    } catch {
      // In isolated environments or non-SSR contexts where Clerk session is absent
      userId = null;
      orgId = null;
      role = null;
    }
  }

  // 3. Initialize tenant-scoped database client if orgId is active
  const db = orgId ? createTenantDb(orgId, prisma) : null;

  return {
    userId,
    orgId,
    role,
    db,
    redis,
  };
}
