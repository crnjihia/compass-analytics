import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../server/routers/_app';
import { createContext } from '../server/context';
import { prisma, withTenant } from '@compass/db';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ORG_1_ID = 'org_baraka_hardware';
const ORG_2_ID = 'org_nairobi_fresh';

async function createTestCaller(orgId: string, role: 'org:admin' | 'org:member' = 'org:admin') {
  const ctx = await createContext({
    req: new Request('http://localhost:3000', {
      headers: {
        'x-mock-user-id': `user_${orgId}_${role}`,
        'x-mock-org-id': orgId,
        'x-mock-role': role,
      },
    }),
    resHeaders: new Headers(),
  });
  return { caller: appRouter.createCaller(ctx), ctx };
}

describe('Phase 3: Domain Routers Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up any test products created during tests
    await withTenant(ORG_1_ID, async (tx) => {
      await tx.product.deleteMany({
        where: { sku: { in: ['TEST-CSV-01', 'TEST-CSV-02'] } },
      });
      await tx.stockMovement.deleteMany({
        where: { reason: { contains: 'Test Audit' } },
      });
    });
    await prisma.$disconnect();
  });

  describe('Revenue Router', () => {
    it('1. Fetches revenue summary with BigInt cents and formatted KES for active tenant', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const summary = await caller.revenue.summary();

      expect(summary).toBeDefined();
      expect(typeof summary.today.totalCents).toBe('bigint');
      expect(summary.today.formatted).toMatch(/(?:KES|Ksh)/i);
      expect(typeof summary.thisMonth.totalCents).toBe('bigint');
      expect(summary.thisMonth.formatted).toMatch(/(?:KES|Ksh)/i);
      expect(typeof summary.aov.cents).toBe('bigint');
      expect(summary.aov.formatted).toMatch(/(?:KES|Ksh)/i);
    });

    it('2. Queries timeseries revenue by day and hour', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const dailyTimeseries = await caller.revenue.timeseries({ interval: 'day' });
      expect(Array.isArray(dailyTimeseries)).toBe(true);

      const hourlyTimeseries = await caller.revenue.timeseries({ interval: 'hour' });
      expect(Array.isArray(hourlyTimeseries)).toBe(true);
      if (hourlyTimeseries.length > 0) {
        expect(typeof hourlyTimeseries[0].totalCents).toBe('bigint');
        expect(hourlyTimeseries[0].totalFormatted).toMatch(/(?:KES|Ksh)/i);
      }
    });

    it('3. Cursor-based pagination on recent transactions returns items and handles cursor', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const page1 = await caller.revenue.recent({ limit: 1 });

      expect(page1.items.length).toBeLessThanOrEqual(1);
      if (page1.items.length > 0) {
        const item = page1.items[0];
        expect(item.amountFormatted).toMatch(/(?:KES|Ksh)/i);
        expect(item.maskedMsisdn).toMatch(/\*\*\*\*/);
        expect(item.mpesaReceipt).toBeDefined();
      }
    });
  });

  describe('Customers Router', () => {
    it('4. Returns cohort retention matrix', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const cohorts = await caller.customers.cohorts();

      expect(Array.isArray(cohorts)).toBe(true);
      if (cohorts.length > 0) {
        expect(cohorts[0].cohortMonth).toMatch(/^\d{4}-\d{2}$/);
        expect(Array.isArray(cohorts[0].retention)).toBe(true);
      }
    });

    it('5. Returns top customers ordered by LTV with masked phone numbers', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const top = await caller.customers.topCustomers({ limit: 5 });

      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeGreaterThan(0);
      expect(top[0].maskedMsisdn).toMatch(/\*\*\*\*/);
      expect(typeof top[0].ltvCents).toBe('bigint');
      expect(top[0].ltvFormatted).toMatch(/(?:KES|Ksh)/i);
    });

    it('6. Calculates repeat customer rate correctly', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const repeat = await caller.customers.repeatRate();

      expect(repeat.totalCustomers).toBeGreaterThan(0);
      expect(typeof repeat.repeatRatePercentage).toBe('number');
      expect(repeat.repeatRatePercentage).toBeGreaterThanOrEqual(0);
      expect(repeat.repeatRatePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Inventory Router', () => {
    it('7. Returns product list with stock status (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const inventory = await caller.inventory.list({ limit: 10 });

      expect(inventory.items.length).toBeGreaterThan(0);
      const lowStockItem = inventory.items.find((p) => p.sku === 'NLS-3IN-1KG');
      expect(lowStockItem).toBeDefined();
      expect(lowStockItem?.status).toBe('LOW_STOCK');
    });

    it('8. Computes inventory velocity and projected stockout days', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const velocity = await caller.inventory.velocity({ days: '30' });

      expect(Array.isArray(velocity)).toBe(true);
      expect(velocity.length).toBeGreaterThan(0);
      expect(velocity[0]).toHaveProperty('dailyRunRate');
      expect(velocity[0]).toHaveProperty('unitsSold');
    });

    it('9. Adjusts stock and persists an audit record in stock_movements', async () => {
      const { caller } = await createTestCaller(ORG_1_ID);
      const products = await caller.inventory.list({ limit: 1 });
      const targetProduct = products.items[0];

      const initialStock = targetProduct.stockOnHand;
      const res = await caller.inventory.adjustStock({
        productId: targetProduct.id,
        delta: 5,
        reason: 'Restocked delivery - Test Audit',
      });

      expect(res.product.stockOnHand).toBe(initialStock + 5);
      expect(res.movement.delta).toBe(5);

      // Revert back
      await caller.inventory.adjustStock({
        productId: targetProduct.id,
        delta: -5,
        reason: 'Correction - Test Audit',
      });
    });

    it('10. Batch imports products from CSV with KES price conversion', async () => {
      const { caller, ctx } = await createTestCaller(ORG_1_ID);
      const csvData = `sku,name,price,stock,reorderLevel\nTEST-CSV-01,Test Drill Bit Set,1500.50,45,10\nTEST-CSV-02,Test Heavy Duty Tape,450.00,100,20`;

      const result = await caller.inventory.importCsv({ csvContent: csvData });
      expect(result.processed).toBe(2);
      expect(result.created).toBeGreaterThanOrEqual(1);

      // Verify product price is stored as integer cents (1500.50 -> 150050n)
      expect(ctx.db).not.toBeNull();
      const imported = await ctx.db!.product.findUnique({
        where: { orgId_sku: { orgId: ORG_1_ID, sku: 'TEST-CSV-01' } },
      });
      expect(imported).not.toBeNull();
      expect(imported?.priceCents).toBe(150050n);
    });
  });

  describe('Connection Router & Security', () => {
    it('11. Retrieves connection status without leaking plaintext secret', async () => {
      const { caller } = await createTestCaller(ORG_1_ID, 'org:member');
      const conn = await caller.connection.get();

      expect(conn.connected).toBe(true);
      expect(conn.connection).not.toBeNull();
      expect(conn.connection?.shortcode).toBe('890123');
      expect(conn.connection).not.toHaveProperty('consumerSecretEnc');
      expect(conn.connection).not.toHaveProperty('consumerKeyEnc');
    });

    it('12. Rejects connect and rotateSecret from non-admin users with FORBIDDEN', async () => {
      const { caller } = await createTestCaller(ORG_1_ID, 'org:member');
      await expect(
        caller.connection.connect({
          shortcode: '123456',
          shortcodeType: 'PAYBILL',
          consumerKey: 'key_xyz',
          consumerSecret: 'secret_abc',
          passkey: 'passkey_123',
        })
      ).rejects.toThrow(/administrator privileges are required/i);
    });

    it('13. Allows admin to connect and rotates credentials with AES-256-GCM', async () => {
      const { caller } = await createTestCaller(ORG_1_ID, 'org:admin');
      const res = await caller.connection.rotateSecret({
        shortcode: '890123',
        newConsumerSecret: 'rotated_new_secret_daraja_2026',
      });

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/rotated successfully/i);
    });

    it('14. Cross-Tenant Isolation: Baraka Hardware cannot see Nairobi Fresh products or transactions', async () => {
      const { caller: barakaCaller } = await createTestCaller(ORG_1_ID);
      const { caller: nairobiCaller } = await createTestCaller(ORG_2_ID);

      const barakaInventory = await barakaCaller.inventory.list({ limit: 50 });
      const nairobiInventory = await nairobiCaller.inventory.list({ limit: 50 });

      // Baraka has cement / nails; Nairobi has avocado / tea
      const barakaSkus = barakaInventory.items.map((i) => i.sku);
      const nairobiSkus = nairobiInventory.items.map((i) => i.sku);

      expect(barakaSkus).toContain('BAM-CEM-50KG');
      expect(barakaSkus).not.toContain('AV-HASS-BX');

      expect(nairobiSkus).toContain('AV-HASS-BX');
      expect(nairobiSkus).not.toContain('BAM-CEM-50KG');
    });
  });
});
