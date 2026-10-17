import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/**
 * Enforces authenticated user with an ACTIVE Clerk Organization.
 * Requests without an active orgId are rejected immediately.
 * Ensures ctx.db is typed as NonNullable<TenantScopedPrismaClient>.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    });
  }

  if (!ctx.orgId || !ctx.db) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Active organization context is required. Please select or switch to an organization.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      orgId: ctx.orgId,
      db: ctx.db,
    },
  });
});

/**
 * Enforces that the user has the 'org:admin' role within the active organization.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.role !== 'org:admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Organization administrator privileges are required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      role: 'org:admin' as const,
    },
  });
});
