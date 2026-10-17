import { router, publicProcedure } from '../trpc';
import { prisma } from '@compass/db';

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    let redisStatus = 'healthy';
    let postgresStatus = 'healthy';

    try {
      const ping = await ctx.redis.ping();
      if (ping !== 'PONG') redisStatus = 'degraded';
    } catch {
      redisStatus = 'unhealthy';
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      postgresStatus = 'unhealthy';
    }

    const overall = redisStatus === 'healthy' && postgresStatus === 'healthy' ? 'healthy' : 'degraded';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
        postgres: postgresStatus,
      },
    };
  }),
});
