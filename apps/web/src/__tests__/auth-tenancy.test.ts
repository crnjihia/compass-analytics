import { describe, it, expect, afterAll } from 'vitest';
import { appRouter } from '../server/routers/_app';
import { prisma, createTenantDb } from '@compass/db';
import { redis } from '../lib/redis';
import { TRPCError } from '@trpc/server';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ORG_A = 'org_baraka_hardware';
const ORG_B = 'org_nairobi_fresh';

describe('Auth & Multi-Tenancy Architecture (Clerk + tRPC + RLS)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('1. Public procedures are accessible without authentication', async () => {
    const unauthCaller = appRouter.createCaller({
      userId: null,
      orgId: null,
      role: null,
      db: null,
      redis,
    });

    const health = await unauthCaller.health();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('compass-web');
  });

  it('2. Protected procedures reject unauthenticated requests with UNAUTHORIZED', async () => {
    const unauthCaller = appRouter.createCaller({
      userId: null,
      orgId: null,
      role: null,
      db: null,
      redis,
    });

    await expect(unauthCaller.whoami()).rejects.toThrowError(TRPCError);
    await expect(unauthCaller.whoami()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('3. Authenticated users without an active organization context are rejected with FORBIDDEN', async () => {
    const noOrgCaller = appRouter.createCaller({
      userId: 'user_clerk_12345',
      orgId: null,
      role: null,
      db: null,
      redis,
    });

    await expect(noOrgCaller.whoami()).rejects.toThrowError(TRPCError);
    await expect(noOrgCaller.whoami()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringMatching(/Active organization context is required/i),
    });
  });

  it('4. Member role (org:member) is rejected from admin procedures with FORBIDDEN', async () => {
    const dbA = createTenantDb(ORG_A, prisma);
    const memberCaller = appRouter.createCaller({
      userId: 'user_member_01',
      orgId: ORG_A,
      role: 'org:member',
      db: dbA,
      redis,
    });

    // Member can access general protected procedures
    const whoami = await memberCaller.whoami();
    expect(whoami.userId).toBe('user_member_01');
    expect(whoami.orgId).toBe(ORG_A);
    expect(whoami.role).toBe('org:member');

    // Member is strictly rejected from admin procedures
    await expect(memberCaller.adminTest()).rejects.toThrowError(TRPCError);
    await expect(memberCaller.adminTest()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringMatching(/administrator privileges are required/i),
    });
  });

  it('5. Admin role (org:admin) is permitted to access admin procedures', async () => {
    const dbA = createTenantDb(ORG_A, prisma);
    const adminCaller = appRouter.createCaller({
      userId: 'user_admin_01',
      orgId: ORG_A,
      role: 'org:admin',
      db: dbA,
      redis,
    });

    const res = await adminCaller.adminTest();
    expect(res.status).toBe('authorized');
    expect(res.orgId).toBe(ORG_A);
    expect(res.role).toBe('org:admin');
  });

  it('6. tRPC tenant isolation: Tenant A caller receives only Tenant A data with zero cross-tenant leakage', async () => {
    const dbA = createTenantDb(ORG_A, prisma);
    const tenantACaller = appRouter.createCaller({
      userId: 'user_tenant_a',
      orgId: ORG_A,
      role: 'org:member',
      db: dbA,
      redis,
    });

    // tenantProducts runs an unfiltered findMany() query on products
    const productsA = await tenantACaller.tenantProducts();
    expect(productsA.length).toBeGreaterThan(0);

    for (const p of productsA) {
      expect(p.orgId).toBe(ORG_A);
      expect(p.orgId).not.toBe(ORG_B);
    }
  });

  it('7. tRPC tenant isolation: Tenant B caller receives only Tenant B data with zero cross-tenant leakage', async () => {
    const dbB = createTenantDb(ORG_B, prisma);
    const tenantBCaller = appRouter.createCaller({
      userId: 'user_tenant_b',
      orgId: ORG_B,
      role: 'org:member',
      db: dbB,
      redis,
    });

    const productsB = await tenantBCaller.tenantProducts();
    expect(productsB.length).toBeGreaterThan(0);

    for (const p of productsB) {
      expect(p.orgId).toBe(ORG_B);
      expect(p.orgId).not.toBe(ORG_A);
    }
  });
});
