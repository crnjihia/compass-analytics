import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { formatKes, parseKesToCents } from '@compass/shared';
import { TRPCError } from '@trpc/server';

export const inventoryRouter = router({
  /**
   * Product List with Stock Status & Pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
        search: z.string().optional(),
        filter: z.enum(['ALL', 'LOW_STOCK', 'OUT_OF_STOCK']).default('ALL'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, filter } = input;

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (filter === 'OUT_OF_STOCK') {
        whereClause.stockOnHand = { lte: 0 };
      }

      const products = await ctx.db.product.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: whereClause,
        orderBy: { stockOnHand: 'asc' },
      });

      // Filter in-memory for LOW_STOCK comparing dynamic reorderLevel
      let filtered = products;
      if (filter === 'LOW_STOCK') {
        filtered = products.filter(
          (p) => p.stockOnHand > 0 && p.stockOnHand <= p.reorderLevel
        );
      }

      let nextCursor: string | null = null;
      if (filtered.length > limit) {
        const nextItem = filtered.pop();
        nextCursor = nextItem?.id ?? null;
      }

      return {
        items: filtered.map((p) => {
          let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
          if (p.stockOnHand <= 0) {
            status = 'OUT_OF_STOCK';
          } else if (p.stockOnHand <= p.reorderLevel) {
            status = 'LOW_STOCK';
          }

          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            priceCents: p.priceCents,
            priceFormatted: formatKes(p.priceCents),
            stockOnHand: p.stockOnHand,
            reorderLevel: p.reorderLevel,
            status,
            updatedAt: p.updatedAt,
          };
        }),
        nextCursor,
      };
    }),

  /**
   * Inventory Velocity (Units Sold & Projected Days Until Stockout)
   */
  velocity: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid().optional(),
        days: z.enum(['7', '30']).default('30'),
      })
    )
    .query(async ({ ctx, input }) => {
      const numDays = parseInt(input.days, 10);
      const sinceDate = new Date(Date.now() - numDays * 86400000);

      const whereClause: any = input.productId ? { id: input.productId } : {};
      const products = await ctx.db.product.findMany({
        where: whereClause,
        include: {
          salesItems: {
            where: {
              soldAt: { gte: sinceDate },
            },
            select: { qty: true },
          },
        },
      });

      return products.map((p) => {
        const unitsSold = p.salesItems.reduce((acc, si) => acc + si.qty, 0);
        const dailyRunRate = Math.round((unitsSold / numDays) * 100) / 100;
        const daysUntilStockout = dailyRunRate > 0
          ? Math.max(0, Math.round(p.stockOnHand / dailyRunRate))
          : null;

        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          stockOnHand: p.stockOnHand,
          reorderLevel: p.reorderLevel,
          periodDays: numDays,
          unitsSold,
          dailyRunRate,
          daysUntilStockout, // null means no sales recorded
          stockStatus: p.stockOnHand <= 0 ? 'OUT_OF_STOCK' : (p.stockOnHand <= p.reorderLevel ? 'LOW_STOCK' : 'HEALTHY'),
        };
      });
    }),

  /**
   * Adjust Stock Quantity with Audit Trail
   */
  adjustStock: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        delta: z.number().int(),
        reason: z.string().min(2, 'A valid adjustment reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { productId, delta, reason } = input;

      const product = await ctx.db.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      const updatedStock = product.stockOnHand + delta;
      if (updatedStock < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot decrease stock by ${Math.abs(delta)}. Current stock is ${product.stockOnHand}.`,
        });
      }

      const [updatedProduct, movement] = await Promise.all([
        ctx.db.product.update({
          where: { id: productId },
          data: { stockOnHand: updatedStock },
        }),
        ctx.db.stockMovement.create({
          data: {
            orgId: ctx.orgId,
            productId,
            delta,
            reason,
          },
        }),
      ]);

      return {
        product: {
          id: updatedProduct.id,
          sku: updatedProduct.sku,
          name: updatedProduct.name,
          stockOnHand: updatedProduct.stockOnHand,
        },
        movement: {
          id: movement.id,
          delta: movement.delta,
          reason: movement.reason,
          createdAt: movement.createdAt,
        },
      };
    }),

  /**
   * CSV Batch Import for Products & Initial Stock
   * Format: sku,name,price,stock,reorderLevel
   */
  importCsv: protectedProcedure
    .input(
      z.object({
        csvContent: z.string().min(1, 'CSV content is empty'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lines = input.csvContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'CSV must contain a header row and at least one data row',
        });
      }

      const header = lines[0].toLowerCase();
      // Expecting: sku,name,price,stock,reorderLevel (or reorder_level)
      if (!header.includes('sku') || !header.includes('name')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid CSV header. Expected at least: sku,name,price,stock,reorderLevel',
        });
      }

      const dataRows = lines.slice(1);
      const results: { sku: string; status: 'created' | 'updated' | 'error'; error?: string }[] = [];

      for (const row of dataRows) {
        const cols = row.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 3) continue;

        const [sku, name, priceStr, stockStr, reorderStr] = cols;

        if (!sku || !name) {
          results.push({ sku: sku || 'unknown', status: 'error', error: 'Missing SKU or Name' });
          continue;
        }

        try {
          const priceCents = parseKesToCents(priceStr || '0');
          const stock = stockStr ? parseInt(stockStr, 10) : 0;
          const reorderLevel = reorderStr ? parseInt(reorderStr, 10) : 10;

          const existing = await ctx.db.product.findUnique({
            where: {
              orgId_sku: {
                orgId: ctx.orgId,
                sku,
              },
            },
          });

          if (existing) {
            await ctx.db.product.update({
              where: { id: existing.id },
              data: {
                name,
                priceCents,
                stockOnHand: stock,
                reorderLevel,
              },
            });
            results.push({ sku, status: 'updated' });
          } else {
            await ctx.db.product.create({
              data: {
                orgId: ctx.orgId,
                sku,
                name,
                priceCents,
                stockOnHand: stock,
                reorderLevel,
              },
            });
            results.push({ sku, status: 'created' });
          }
        } catch (err: any) {
          results.push({ sku, status: 'error', error: err.message });
        }
      }

      return {
        processed: results.length,
        created: results.filter((r) => r.status === 'created').length,
        updated: results.filter((r) => r.status === 'updated').length,
        errors: results.filter((r) => r.status === 'error'),
      };
    }),
});
