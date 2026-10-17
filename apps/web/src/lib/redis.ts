import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis | undefined };

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis =
  globalForRedis.redis ||
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

export function createRedisSubscriber(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
