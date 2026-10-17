-- ==============================================================================
-- Initial Migration: Schema Creation & PostgreSQL Row-Level Security (RLS)
-- Isolation boundary: All tenant tables enforce RLS strictly for non-superuser
-- app role (compass_app) using session variable 'app.org_id'.
-- ==============================================================================

-- 1. Ensure non-superuser role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'compass_app') THEN
    CREATE ROLE compass_app WITH LOGIN PASSWORD 'compass_secret' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE compass_app WITH NOBYPASSRLS NOSUPERUSER;
  END IF;
END
$$;

-- 2. Create tables
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerk_org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_clerk_org_id_key" ON "organizations"("clerk_org_id");

CREATE TABLE IF NOT EXISTS "mpesa_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "shortcode_type" TEXT NOT NULL,
    "consumer_key_enc" TEXT NOT NULL,
    "consumer_secret_enc" TEXT NOT NULL,
    "passkey_enc" TEXT NOT NULL,
    "callback_secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "mpesa_connections_org_id_shortcode_key" ON "mpesa_connections"("org_id", "shortcode");

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mpesa_receipt" TEXT NOT NULL,
    "msisdn_hash" TEXT NOT NULL,
    "masked_msisdn" TEXT NOT NULL,
    "customer_name" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "bill_ref" TEXT,
    "paid_at" TIMESTAMPTZ NOT NULL,
    "raw" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_org_id_mpesa_receipt_key" ON "transactions"("org_id", "mpesa_receipt");
CREATE INDEX IF NOT EXISTS "transactions_org_id_paid_at_idx" ON "transactions"("org_id", "paid_at" DESC);

CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "msisdn_hash" TEXT NOT NULL,
    "masked_msisdn" TEXT NOT NULL,
    "customer_name" TEXT,
    "first_seen_at" TIMESTAMPTZ NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    "txn_count" INTEGER NOT NULL DEFAULT 0,
    "ltv_cents" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "customers_org_id_msisdn_hash_key" ON "customers"("org_id", "msisdn_hash");
CREATE INDEX IF NOT EXISTS "customers_org_id_ltv_cents_idx" ON "customers"("org_id", "ltv_cents" DESC);

CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" BIGINT NOT NULL,
    "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "products_org_id_sku_key" ON "products"("org_id", "sku");
CREATE INDEX IF NOT EXISTS "products_org_id_stock_on_hand_idx" ON "products"("org_id", "stock_on_hand");

CREATE TABLE IF NOT EXISTS "sales_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "product_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_cents" BIGINT NOT NULL,
    "sold_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "sales_items_org_id_sold_at_idx" ON "sales_items"("org_id", "sold_at" DESC);

CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "stock_movements_org_id_product_id_idx" ON "stock_movements"("org_id", "product_id");

CREATE TABLE IF NOT EXISTS "revenue_hourly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "bucket" TIMESTAMPTZ NOT NULL,
    "total_cents" BIGINT NOT NULL DEFAULT 0,
    "txn_count" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_hourly_org_id_bucket_key" ON "revenue_hourly"("org_id", "bucket");
CREATE INDEX IF NOT EXISTS "revenue_hourly_org_id_bucket_idx" ON "revenue_hourly"("org_id", "bucket" DESC);

CREATE TABLE IF NOT EXISTS "cohort_monthly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "cohort_month" TIMESTAMPTZ NOT NULL,
    "period_n" INTEGER NOT NULL,
    "active_customers" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "cohort_monthly_org_id_cohort_month_period_n_key" ON "cohort_monthly"("org_id", "cohort_month", "period_n");
CREATE INDEX IF NOT EXISTS "cohort_monthly_org_id_cohort_month_idx" ON "cohort_monthly"("org_id", "cohort_month");

-- 3. Enable and FORCE Row-Level Security on every table
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "mpesa_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mpesa_connections" FORCE ROW LEVEL SECURITY;

ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;

ALTER TABLE "sales_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;

ALTER TABLE "revenue_hourly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revenue_hourly" FORCE ROW LEVEL SECURITY;

ALTER TABLE "cohort_monthly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohort_monthly" FORCE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for non-superuser role 'compass_app'
DROP POLICY IF EXISTS org_isolation_policy ON "organizations";
CREATE POLICY org_isolation_policy ON "organizations"
    FOR ALL
    TO compass_app
    USING ("clerk_org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("clerk_org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "mpesa_connections";
CREATE POLICY tenant_isolation_policy ON "mpesa_connections"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "transactions";
CREATE POLICY tenant_isolation_policy ON "transactions"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "customers";
CREATE POLICY tenant_isolation_policy ON "customers"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "products";
CREATE POLICY tenant_isolation_policy ON "products"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "sales_items";
CREATE POLICY tenant_isolation_policy ON "sales_items"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "stock_movements";
CREATE POLICY tenant_isolation_policy ON "stock_movements"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "revenue_hourly";
CREATE POLICY tenant_isolation_policy ON "revenue_hourly"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_policy ON "cohort_monthly";
CREATE POLICY tenant_isolation_policy ON "cohort_monthly"
    FOR ALL
    TO compass_app
    USING ("org_id" = NULLIF(current_setting('app.org_id', true), ''))
    WITH CHECK ("org_id" = NULLIF(current_setting('app.org_id', true), ''));

-- 5. Grant access permissions to compass_app
GRANT ALL ON ALL TABLES IN SCHEMA public TO compass_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO compass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO compass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO compass_app;
