import { describe, it, expect, afterAll } from 'vitest';
import { SingleFlight, withTenantCache, invalidateTenantCache, getTenantVersion } from '../lib/cache';
import { redis } from '../lib/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ORG_A = 'org_test_cache_tenant_a';
const ORG_B = 'org_test_cache_tenant_b';

describe('Phase 7: Redis Caching & Single-Flight Request Coalescing', () => {
  afterAll(async () => {
    // Clean up test keys from Redis
    const keys = await redis.keys('cache:org_test_cache_*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del(`org:${ORG_A}:cache_version`, `org:${ORG_B}:cache_version`);
    redis.disconnect();
  });

  describe('SingleFlight Coalescer', () => {
    it('1. Coalesces 10 concurrent requests into exactly 1 underlying execution', async () => {
      const sf = new SingleFlight();
      let executionCount = 0;

      const slowFetcher = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: 'heavy_db_aggregation_result', timestamp: Date.now() };
      };

      // Launch 10 simultaneous callers for the identical key
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() => sf.do('heavy_query_key_1', slowFetcher))
      );

      // Verify that underlying fetcher was executed ONLY once!
      expect(executionCount).toBe(1);

      // Verify that all 10 callers received identical result
      expect(results.length).toBe(10);
      for (const res of results) {
        expect(res.data).toBe('heavy_db_aggregation_result');
        expect(res.timestamp).toBe(results[0].timestamp);
      }
    });
  });

  describe('Tenant Caching & SuperJSON BigInt Serialization', () => {
    it('2. Caches result in Redis and preserves BigInt cents and Date types without float corruption', async () => {
      let dbCalls = 0;

      const fetcher = async () => {
        dbCalls++;
        return {
          orgId: ORG_A,
          totalCents: 9876543210n, // BigInt cents
          recordedAt: new Date(),
          items: ['Item 1', 'Item 2'],
        };
      };

      // First call: Cache miss -> calls fetcher -> writes to Redis
      const first = await withTenantCache(
        { orgId: ORG_A, resource: 'test:metrics', ttlSeconds: 30 },
        fetcher
      );

      expect(dbCalls).toBe(1);
      expect(typeof first.totalCents).toBe('bigint');
      expect(first.totalCents).toBe(9876543210n);
      expect(first.recordedAt).toBeInstanceOf(Date);

      // Second call: Cache hit -> reads from Redis -> fetcher NOT called
      const second = await withTenantCache(
        { orgId: ORG_A, resource: 'test:metrics', ttlSeconds: 30 },
        fetcher
      );

      expect(dbCalls).toBe(1); // Still 1! Cache hit!
      expect(typeof second.totalCents).toBe('bigint');
      expect(second.totalCents).toBe(9876543210n);
      expect(second.recordedAt.toISOString()).toBe(first.recordedAt.toISOString());
    });

    it('3. Atomically invalidates tenant cache via O(1) version increment', async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { counter: callCount };
      };

      // Warm cache
      const r1 = await withTenantCache(
        { orgId: ORG_A, resource: 'test:versioning', ttlSeconds: 30 },
        fetcher
      );
      expect(r1.counter).toBe(1);
      expect(callCount).toBe(1);

      // Read from cache
      const r2 = await withTenantCache(
        { orgId: ORG_A, resource: 'test:versioning', ttlSeconds: 30 },
        fetcher
      );
      expect(r2.counter).toBe(1);
      expect(callCount).toBe(1);

      // Invalidate Tenant A's cache (e.g. after new transaction or stock adjustment)
      const newVersion = await invalidateTenantCache(ORG_A);
      expect(newVersion).toBeGreaterThan(1);

      // Next call after invalidation MUST fetch fresh data
      const r3 = await withTenantCache(
        { orgId: ORG_A, resource: 'test:versioning', ttlSeconds: 30 },
        fetcher
      );
      expect(r3.counter).toBe(2);
      expect(callCount).toBe(2);
    });

    it('4. Multi-Tenant Cache Isolation: Tenant A and Tenant B never share cached data', async () => {
      const fetchA = async () => ({ tenant: 'A', secret: 'data_a' });
      const fetchB = async () => ({ tenant: 'B', secret: 'data_b' });

      const resA = await withTenantCache(
        { orgId: ORG_A, resource: 'shared_endpoint_name', ttlSeconds: 30 },
        fetchA
      );
      const resB = await withTenantCache(
        { orgId: ORG_B, resource: 'shared_endpoint_name', ttlSeconds: 30 },
        fetchB
      );

      expect(resA.tenant).toBe('A');
      expect(resA.secret).toBe('data_a');

      expect(resB.tenant).toBe('B');
      expect(resB.secret).toBe('data_b');
    });
  });
});
