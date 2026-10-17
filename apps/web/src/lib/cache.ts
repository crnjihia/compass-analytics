import { redis } from './redis';
import superjson from 'superjson';
import crypto from 'crypto';

/**
 * SingleFlight coalesces concurrent identical asynchronous operations
 * so that only one execution is active at a time, preventing cache stampedes.
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<any>>();

  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  get activeCount(): number {
    return this.inFlight.size;
  }
}

export const singleFlight = new SingleFlight();

export interface CacheOptions {
  orgId: string;
  resource: string;
  params?: any;
  ttlSeconds?: number;
}

/**
 * Retrieves the current tenant cache version for O(1) atomic tenant-wide cache busting.
 */
export async function getTenantVersion(orgId: string): Promise<number> {
  try {
    const key = `org:${orgId}:cache_version`;
    const versionStr = await redis.get(key);
    if (!versionStr) {
      await redis.set(key, '1');
      return 1;
    }
    return parseInt(versionStr, 10) || 1;
  } catch {
    return 1;
  }
}

/**
 * Atomically invalidates all cached metrics for a tenant by bumping the version counter.
 */
export async function invalidateTenantCache(orgId: string): Promise<number> {
  try {
    const key = `org:${orgId}:cache_version`;
    // If not exists, initialize to 1 first
    const exists = await redis.exists(key);
    if (!exists) {
      await redis.set(key, '1');
    }
    const newVersion = await redis.incr(key);
    return newVersion;
  } catch (err) {
    console.error(`[Cache] Error invalidating tenant cache for ${orgId}:`, err);
    return 2;
  }
}

/**
 * Generate a deterministic hash for cache parameters.
 */
function hashParams(params: any): string {
  if (!params) return 'default';
  const str = typeof params === 'string' ? params : JSON.stringify(params);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * High-performance tenant-scoped caching with Single-Flight coalescing and SuperJSON serialization.
 */
export async function withTenantCache<T>(
  options: CacheOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  const { orgId, resource, params, ttlSeconds = 60 } = options;
  const version = await getTenantVersion(orgId);
  const paramHash = hashParams(params);
  const cacheKey = `cache:${orgId}:v${version}:${resource}:${paramHash}`;

  // 1. Try Cache Read
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return superjson.parse<T>(cached);
    }
  } catch (err) {
    console.warn(`[Cache] Error reading key ${cacheKey}:`, err);
  }

  // 2. Cache Miss: Execute via Single-Flight to prevent cache stampede
  const result = await singleFlight.do(cacheKey, async () => {
    // Double-check cache inside single-flight lock
    try {
      const doubleCheck = await redis.get(cacheKey);
      if (doubleCheck) {
        return superjson.parse<T>(doubleCheck);
      }
    } catch {}

    const fresh = await fetcher();

    // 3. Serialize with SuperJSON (preserves BigInt cents and Dates) and write to Redis
    try {
      const serialized = superjson.stringify(fresh);
      await redis.setex(cacheKey, ttlSeconds, serialized);
    } catch (err) {
      console.warn(`[Cache] Error writing key ${cacheKey}:`, err);
    }

    return fresh;
  });

  return result;
}
