import { PrismaClient, Prisma } from '../generated/client';

/**
 * Global root PrismaClient instance.
 * Note: Under production / unprivileged runtime, this connects with the compass_app
 * role where Row-Level Security (RLS) is strictly enforced.
 */
export const prisma = new PrismaClient();

export type TenantScopedPrismaClient = ReturnType<typeof createTenantDb>;

/**
 * Execute a unit of work inside an interactive PostgreSQL transaction
 * scoped to the specified tenant orgId via `set_config('app.org_id', $1, true)`.
 */
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    // Set session variable app.org_id local to this transaction (true = is_local)
    await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, orgId);
    return fn(tx);
  });
}

/**
 * Creates a tenant-scoped Prisma client extension.
 * Every query automatically executes in a transaction with `set_config('app.org_id', $1, true)`
 * and create/upsert operations auto-inject the orgId property.
 */
export function createTenantDb(orgId: string, baseClient: PrismaClient = prisma) {
  if (!orgId) {
    throw new Error('Tenant orgId must be provided to createTenantDb');
  }

  return baseClient.$extends({
    name: 'tenant-rls-extension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Auto-inject org_id on tenant models during write operations
          if (model !== 'Organization') {
            if (operation === 'create') {
              const createArgs = args as { data?: Record<string, unknown> };
              createArgs.data = { ...createArgs.data, orgId };
            } else if (operation === 'createMany') {
              const createManyArgs = args as { data?: Record<string, unknown> | Record<string, unknown>[] };
              if (Array.isArray(createManyArgs.data)) {
                createManyArgs.data = createManyArgs.data.map((d) => ({ ...d, orgId }));
              } else if (createManyArgs.data) {
                createManyArgs.data = { ...createManyArgs.data, orgId };
              }
            } else if (operation === 'upsert') {
              const upsertArgs = args as { create?: Record<string, unknown> };
              upsertArgs.create = { ...upsertArgs.create, orgId };
            }
          }

          // Execute operation inside a transaction that sets the session variable
          return baseClient.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, orgId);
            // Run operation through the configured transaction client
            const modelDelegate = (tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
              model.charAt(0).toLowerCase() + model.slice(1)
            ];
            if (modelDelegate && typeof modelDelegate[operation] === 'function') {
              return modelDelegate[operation](args);
            }
            return query(args);
          });
        },
      },
    },
  });
}
