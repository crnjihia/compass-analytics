import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { formatKes } from '@compass/shared';
import { withTenantCache } from '../../lib/cache';

export const customersRouter = router({
  /**
   * Monthly Cohort Retention Matrix
   */
  cohorts: protectedProcedure.query(async ({ ctx }) => {
    return withTenantCache(
      {
        orgId: ctx.orgId,
        resource: 'customers:cohorts',
        ttlSeconds: 300,
      },
      async () => {
        const rawCohorts = await ctx.db.cohortMonthly.findMany({
          orderBy: [
            { cohortMonth: 'asc' },
            { periodN: 'asc' },
          ],
        });

        // Group by cohortMonth
        const cohortsMap = new Map<string, { cohortMonth: string; initialCustomers: number; retention: { period: number; active: number; rate: number }[] }>();

        for (const entry of rawCohorts) {
          const monthKey = entry.cohortMonth.toISOString().slice(0, 7); // YYYY-MM
          let cohort = cohortsMap.get(monthKey);

          if (!cohort) {
            cohort = {
              cohortMonth: monthKey,
              initialCustomers: entry.periodN === 0 ? entry.activeCustomers : 0,
              retention: [],
            };
            cohortsMap.set(monthKey, cohort);
          }

          if (entry.periodN === 0) {
            cohort.initialCustomers = entry.activeCustomers;
          }

          const initial = cohort.initialCustomers || entry.activeCustomers || 1;
          const rate = Math.round((entry.activeCustomers / initial) * 1000) / 10;

          cohort.retention.push({
            period: entry.periodN,
            active: entry.activeCustomers,
            rate,
          });
        }

        return Array.from(cohortsMap.values());
      }
    );
  }),

  /**
   * Top Customers by Lifetime Value (LTV)
   */
  topCustomers: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const customers = await ctx.db.customer.findMany({
        take: input.limit,
        orderBy: { ltvCents: 'desc' },
      });

      return customers.map((c) => ({
        id: c.id,
        customerName: c.customerName || 'Anonymous Customer',
        maskedMsisdn: c.maskedMsisdn,
        txnCount: c.txnCount,
        ltvCents: c.ltvCents,
        ltvFormatted: formatKes(c.ltvCents),
        firstSeenAt: c.firstSeenAt,
        lastSeenAt: c.lastSeenAt,
      }));
    }),

  /**
   * Repeat Customer Rate & Metrics
   */
  repeatRate: protectedProcedure.query(async ({ ctx }) => {
    return withTenantCache(
      {
        orgId: ctx.orgId,
        resource: 'customers:repeatRate',
        ttlSeconds: 120,
      },
      async () => {
        const [totalCustomers, repeatCustomers] = await Promise.all([
          ctx.db.customer.count(),
          ctx.db.customer.count({
            where: {
              txnCount: { gt: 1 },
            },
          }),
        ]);

        const rate = totalCustomers > 0
          ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10
          : 0;

        return {
          totalCustomers,
          repeatCustomers,
          oneTimeCustomers: totalCustomers - repeatCustomers,
          repeatRatePercentage: rate,
        };
      }
    );
  }),

  /**
   * Paginated Customer Directory
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      const whereClause = search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { maskedMsisdn: { contains: search } },
            ],
          }
        : undefined;

      const items = await ctx.db.customer.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: whereClause,
        orderBy: { ltvCents: 'desc' },
      });

      let nextCursor: string | null = null;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id ?? null;
      }

      return {
        items: items.map((c) => ({
          id: c.id,
          customerName: c.customerName || 'Anonymous',
          maskedMsisdn: c.maskedMsisdn,
          txnCount: c.txnCount,
          ltvCents: c.ltvCents,
          ltvFormatted: formatKes(c.ltvCents),
          firstSeenAt: c.firstSeenAt,
          lastSeenAt: c.lastSeenAt,
        })),
        nextCursor,
      };
    }),
});
