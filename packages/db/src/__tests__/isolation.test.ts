import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/client';
import { createTenantDb, withTenant } from '../client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const APP_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://compass_app:compass_secret@localhost:5432/compass_analytics?sslmode=disable';

const ORG_A = 'org_baraka_hardware';
const ORG_B = 'org_nairobi_fresh';

describe('PostgreSQL Multi-Tenant Row-Level Security (RLS) Isolation', () => {
  let appPool: Pool;
  let appPrisma: PrismaClient;

  beforeAll(async () => {
    // Connect explicitly as the unprivileged compass_app non-superuser role
    appPool = new Pool({ connectionString: APP_DATABASE_URL });
    appPrisma = new PrismaClient({
      datasources: {
        db: { url: APP_DATABASE_URL },
      },
    });

    // Verify current user is non-superuser compass_app
    const res = await appPool.query('SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    expect(res.rows[0].current_user).toBe('compass_app');
    expect(res.rows[0].rolbypassrls).toBe(false);
  });

  afterAll(async () => {
    await appPool.end();
    await appPrisma.$disconnect();
  });

  it('1. Raw unfiltered query without app.org_id setting returns zero tenant rows', async () => {
    const client = await appPool.connect();
    try {
      // Ensure session variable is empty/unset
      await client.query("SELECT set_config('app.org_id', '', false)");

      const txns = await client.query('SELECT * FROM transactions');
      expect(txns.rows).toHaveLength(0);

      const products = await client.query('SELECT * FROM products');
      expect(products.rows).toHaveLength(0);

      const customers = await client.query('SELECT * FROM customers');
      expect(customers.rows).toHaveLength(0);

      const orgs = await client.query('SELECT * FROM organizations');
      expect(orgs.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('2. Tenant A context (app.org_id = ORG_A) can only read Tenant A rows', async () => {
    const client = await appPool.connect();
    try {
      await client.query("SELECT set_config('app.org_id', $1, false)", [ORG_A]);

      const txns = await client.query('SELECT * FROM transactions');
      expect(txns.rows.length).toBeGreaterThan(0);
      for (const row of txns.rows) {
        expect(row.org_id).toBe(ORG_A);
      }

      const products = await client.query('SELECT * FROM products');
      expect(products.rows.length).toBeGreaterThan(0);
      for (const row of products.rows) {
        expect(row.org_id).toBe(ORG_A);
      }
    } finally {
      client.release();
    }
  });

  it('3. Tenant B context (app.org_id = ORG_B) can only read Tenant B rows', async () => {
    const client = await appPool.connect();
    try {
      await client.query("SELECT set_config('app.org_id', $1, false)", [ORG_B]);

      const txns = await client.query('SELECT * FROM transactions');
      expect(txns.rows.length).toBeGreaterThan(0);
      for (const row of txns.rows) {
        expect(row.org_id).toBe(ORG_B);
      }

      const products = await client.query('SELECT * FROM products');
      expect(products.rows.length).toBeGreaterThan(0);
      for (const row of products.rows) {
        expect(row.org_id).toBe(ORG_B);
      }
    } finally {
      client.release();
    }
  });

  it('4. Cross-tenant write: Tenant A attempting to insert with ORG_B fails with RLS WITH CHECK violation', async () => {
    const client = await appPool.connect();
    try {
      await client.query("SELECT set_config('app.org_id', $1, false)", [ORG_A]);

      // Attempt to maliciously insert a product for Tenant B while in Tenant A session
      let errorThrown = false;
      try {
        await client.query(
          `INSERT INTO products (id, org_id, sku, name, price_cents, stock_on_hand, reorder_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['test-fake-product-id', ORG_B, 'MALICIOUS-SKU', 'Hacked Product', 50000, 10, 5]
        );
      } catch (err: any) {
        errorThrown = true;
        // PostgreSQL error code 44000: with_check_violation
        expect(err.message).toMatch(/violates row-level security policy/i);
      }

      expect(errorThrown).toBe(true);
    } finally {
      client.release();
    }
  });

  it('5. Cross-tenant update: Tenant A cannot update Tenant B records', async () => {
    const client = await appPool.connect();
    try {
      await client.query("SELECT set_config('app.org_id', $1, false)", [ORG_A]);

      // Attempt to update all products for Tenant B
      const updateResult = await client.query(
        "UPDATE products SET price_cents = 1 WHERE org_id = $1",
        [ORG_B]
      );
      // RLS hides Tenant B rows from Tenant A, so 0 rows are matched/updated
      expect(updateResult.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it('6. Tenant-scoped Prisma extension (createTenantDb) automatically enforces isolation', async () => {
    const tenantDbA = createTenantDb(ORG_A, appPrisma);
    const tenantDbB = createTenantDb(ORG_B, appPrisma);

    // Queries executed without any manual WHERE clause
    const productsA = await tenantDbA.product.findMany();
    const productsB = await tenantDbB.product.findMany();

    expect(productsA.length).toBeGreaterThan(0);
    expect(productsB.length).toBeGreaterThan(0);

    for (const p of productsA) {
      expect(p.orgId).toBe(ORG_A);
    }

    for (const p of productsB) {
      expect(p.orgId).toBe(ORG_B);
    }
  });

  it('7. Tenant-scoped Prisma withTenant transaction runner scopes transactions properly', async () => {
    const orgATxns = await withTenant(ORG_A, async (tx) => {
      return tx.transaction.findMany();
    }, appPrisma);

    expect(orgATxns.length).toBeGreaterThan(0);
    for (const txn of orgATxns) {
      expect(txn.orgId).toBe(ORG_A);
    }
  });
});
