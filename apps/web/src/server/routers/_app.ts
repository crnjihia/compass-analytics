import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc';
import { revenueRouter } from './revenue';
import { customersRouter } from './customers';
import { inventoryRouter } from './inventory';
import { connectionRouter } from './connection';
import { healthRouter } from './health';

export const appRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    let redisConnected = false;
    try {
      const ping = await ctx.redis.ping();
      redisConnected = ping === 'PONG';
    } catch {
      redisConnected = false;
    }

    return {
      status: 'ok',
      service: 'compass-web',
      timestamp: new Date().toISOString(),
      redis: redisConnected ? 'connected' : 'disconnected',
    };
  }),

  whoami: protectedProcedure.query(({ ctx }) => {
    return {
      userId: ctx.userId,
      orgId: ctx.orgId,
      role: ctx.role,
    };
  }),

  // Verification procedure: executes an unfiltered query through ctx.db
  // Row-Level Security automatically guarantees only rows for ctx.orgId are returned
  tenantProducts: protectedProcedure.query(async ({ ctx }) => {
    const products = await ctx.db.product.findMany();
    return products;
  }),

  // Admin-only procedure for connecting or modifying tenant configuration
  adminTest: adminProcedure.query(({ ctx }) => {
    return {
      status: 'authorized',
      orgId: ctx.orgId,
      role: ctx.role,
    };
  }),

  // Domain Sub-Routers
  revenue: revenueRouter,
  customers: customersRouter,
  inventory: inventoryRouter,
  connection: connectionRouter,
  systemHealth: healthRouter,
});

export type AppRouter = typeof appRouter;
