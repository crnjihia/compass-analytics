import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { formatKes, formatKesCompact } from '@compass/shared';
import { withTenantCache } from '../../lib/cache';

export const revenueRouter = router({
  /**
   * KPI Summary: Today, Yesterday, This Month, Last Month, AOV, and Delta %
   */
  summary: protectedProcedure
    .input(
      z
        .object({
          timezone: z.string().default('Africa/Nairobi'),
        })
        .optional()
    )
    .query(async ({ ctx }) => {
      return withTenantCache(
        {
          orgId: ctx.orgId,
          resource: 'revenue:summary',
          ttlSeconds: 60,
        },
        async () => {
          const now = new Date();

          // Today start in UTC
          const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
          const yesterdayStart = new Date(todayStart.getTime() - 86400000);
          const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
          const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
          const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);

          // Execute queries within tenant RLS boundary
          const [todayTxns, yesterdayTxns, thisMonthTxns, lastMonthTxns] = await Promise.all([
            ctx.db.transaction.findMany({
              where: { paidAt: { gte: todayStart } },
              select: { amountCents: true },
            }),
            ctx.db.transaction.findMany({
              where: { paidAt: { gte: yesterdayStart, lt: todayStart } },
              select: { amountCents: true },
            }),
            ctx.db.transaction.findMany({
              where: { paidAt: { gte: thisMonthStart } },
              select: { amountCents: true },
            }),
            ctx.db.transaction.findMany({
              where: { paidAt: { gte: lastMonthStart, lte: lastMonthEnd } },
              select: { amountCents: true },
            }),
          ]);

          const sumCents = (txns: { amountCents: bigint }[]) =>
            txns.reduce((acc, t) => acc + t.amountCents, 0n);

          const todayCents = sumCents(todayTxns);
          const yesterdayCents = sumCents(yesterdayTxns);
          const thisMonthCents = sumCents(thisMonthTxns);
          const lastMonthCents = sumCents(lastMonthTxns);

          // Calculate percentage changes
          const calculateDelta = (current: bigint, previous: bigint): number => {
            if (previous === 0n) return current > 0n ? 100 : 0;
            const diff = Number(current - previous);
            const prev = Number(previous);
            return Math.round((diff / prev) * 1000) / 10;
          };

          const dayOverDayDelta = calculateDelta(todayCents, yesterdayCents);
          const monthOverMonthDelta = calculateDelta(thisMonthCents, lastMonthCents);

          // Average Order Value (AOV) for this month
          const aovCents = thisMonthTxns.length > 0
            ? thisMonthCents / BigInt(thisMonthTxns.length)
            : 0n;

          return {
            today: {
              totalCents: todayCents,
              formatted: formatKes(todayCents),
              txnCount: todayTxns.length,
              deltaPercentage: dayOverDayDelta,
            },
            yesterday: {
              totalCents: yesterdayCents,
              formatted: formatKes(yesterdayCents),
              txnCount: yesterdayTxns.length,
            },
            thisMonth: {
              totalCents: thisMonthCents,
              formatted: formatKes(thisMonthCents),
              formattedCompact: formatKesCompact(thisMonthCents),
              txnCount: thisMonthTxns.length,
              deltaPercentage: monthOverMonthDelta,
            },
            lastMonth: {
              totalCents: lastMonthCents,
              formatted: formatKes(lastMonthCents),
              txnCount: lastMonthTxns.length,
            },
            aov: {
              cents: aovCents,
              formatted: formatKes(aovCents),
            },
          };
        }
      );
    }),

  /**
   * Timeseries Revenue Trend (hourly, daily, weekly, monthly buckets)
   */
  timeseries: protectedProcedure
    .input(
      z.object({
        interval: z.enum(['hour', 'day', 'week', 'month']).default('day'),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return withTenantCache(
        {
          orgId: ctx.orgId,
          resource: 'revenue:timeseries',
          params: input,
          ttlSeconds: 120,
        },
        async () => {
          const { interval, from, to } = input;
          const startDate = from || new Date(Date.now() - 30 * 86400000);
          const endDate = to || new Date();

          if (interval === 'hour') {
            const hourlyRollups = await ctx.db.revenueHourly.findMany({
              where: {
                bucket: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              orderBy: { bucket: 'asc' },
            });

            return hourlyRollups.map((r) => ({
              bucket: r.bucket.toISOString(),
              totalCents: r.totalCents,
              totalFormatted: formatKes(r.totalCents),
              txnCount: r.txnCount,
            }));
          }

          // Query transactions within date range
          const transactions = await ctx.db.transaction.findMany({
            where: {
              paidAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              paidAt: true,
              amountCents: true,
            },
            orderBy: { paidAt: 'asc' },
          });

          // Group transactions into buckets according to requested interval
          const bucketsMap = new Map<string, { totalCents: bigint; txnCount: number }>();

          for (const txn of transactions) {
            const date = new Date(txn.paidAt);
            let key: string;

            if (interval === 'day') {
              key = date.toISOString().slice(0, 10);
            } else if (interval === 'month') {
              key = date.toISOString().slice(0, 7);
            } else {
              // week
              const day = date.getUTCDay();
              const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
              key = monday.toISOString().slice(0, 10);
            }

            const current = bucketsMap.get(key) || { totalCents: 0n, txnCount: 0 };
            current.totalCents += txn.amountCents;
            current.txnCount += 1;
            bucketsMap.set(key, current);
          }

          return Array.from(bucketsMap.entries()).map(([bucket, data]) => ({
            bucket,
            totalCents: data.totalCents,
            totalFormatted: formatKes(data.totalCents),
            txnCount: data.txnCount,
          }));
        }
      );
    }),

  /**
   * Recent Transactions with Cursor-Based Pagination
   */
  recent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const items = await ctx.db.transaction.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { paidAt: 'desc' },
        include: {
          salesItems: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
        },
      });

      let nextCursor: string | null = null;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id ?? null;
      }

      return {
        items: items.map((t) => ({
          id: t.id,
          mpesaReceipt: t.mpesaReceipt,
          maskedMsisdn: t.maskedMsisdn,
          customerName: t.customerName || 'Anonymous Customer',
          amountCents: t.amountCents,
          amountFormatted: formatKes(t.amountCents),
          billRef: t.billRef,
          paidAt: t.paidAt,
          itemsCount: t.salesItems.length,
          salesItems: t.salesItems.map((si) => ({
            id: si.id,
            productName: si.product.name,
            sku: si.product.sku,
            qty: si.qty,
            unitPriceCents: si.unitPriceCents,
            unitPriceFormatted: formatKes(si.unitPriceCents),
          })),
        })),
        nextCursor,
      };
    }),
});
