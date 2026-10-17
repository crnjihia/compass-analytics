---
number: 0006
title: SingleFlight Stampede Protection and Tenant-Versioned Cache Invalidation
status: accepted
date: 2026-10-17
---

## Context

Analytical queries (e.g. 30-day hourly revenue rollups, retention cohorts) are computationally expensive across large transaction tables. When cached results expire during peak retail hours, multiple concurrent requests from dashboard users for the same tenant can hit the database simultaneously—a classic "cache stampede" or "thundering herd" problem that exhausts database connection pools.

Furthermore, invalidating cached tenant queries after inventory adjustments or CSV imports typically requires expensive Redis `KEYS` or `SCAN` operations that degrade Redis throughput.

## Decision

We implemented:
1. **SingleFlight Concurrency Coalescing**:
   - An in-memory single-flight barrier deduplicates identical in-flight promises.
   - If 50 concurrent requests demand the same tenant timeseries data while the cache is cold, only one execution proceeds to the database; the remaining 49 await that single promise and share its result.
2. **Tenant-Versioned Keys for O(1) Bulk Cache Invalidation**:
   - Cache keys are namespaced with the tenant's current version counter:
     ```
     cache:org:{orgId}:v{version}:{key}
     ```
   - When a tenant mutates state (e.g. adjusting inventory stock, uploading bulk CSV transactions), the application executes an atomic Redis increment:
     ```
     INCR org:{orgId}:cache_version
     ```
   - This instantly renders all previous cached queries for that tenant obsolete in $O(1)$ time without scanning or deleting thousands of individual keys.

## Consequences

### Positive:
- Protects PostgreSQL from connection saturation during simultaneous dashboard logins.
- Cache invalidation completes in < 1 millisecond regardless of tenant dataset size.
- SuperJSON preserves `BigInt` and `Date` types across Redis cache boundaries.

### Negative / Trade-offs:
- Old cached keys linger in Redis until their TTL expires (10 minutes). We rely on Redis `volatile-lru` eviction policy to reclaim memory if capacity thresholds are approached.
