---
number: 0002
title: PostgreSQL Row-Level Security (RLS) for Tenant Isolation
status: accepted
date: 2026-10-17
---

## Context

Compass Analytics is a multi-tenant SaaS platform where multiple Kenyan businesses (e.g. Baraka Hardware, Nairobi Fresh, Simba Cement) operate on shared infrastructure. Data leakage between competing businesses would be catastrophic for platform trust and legal compliance (Kenya Data Protection Act 2019).

We evaluated three multi-tenant architectural strategies:
1. **Database-per-Tenant**: Dedicated PostgreSQL database or schema per organization.
2. **Application-Level Filtering**: Adding `WHERE org_id = ?` clauses in Prisma ORM queries.
3. **Engine-Enforced Row-Level Security (RLS)**: Shared schema with PostgreSQL RLS policies governed by session configuration `current_setting('app.org_id', true)`.

## Decision

We chose **PostgreSQL Row-Level Security (RLS) with session-scoped tenant contexts** (`current_setting('app.org_id', true)`).

Implementation specifics:
- All tenant tables (`Customer`, `Transaction`, `InventoryItem`, `StockMovement`, `HourlyRevenueRollup`, `ConnectionSettings`) enforce `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- RLS Policies: `USING (org_id = current_setting('app.org_id', true))` and `WITH CHECK (org_id = current_setting('app.org_id', true))`.
- The application executes queries through a Prisma extension `createTenantDb(orgId)` which wraps all queries inside an interactive transaction:
  ```sql
  SET LOCAL app.org_id = $1;
  ```
- If a query is executed without `app.org_id` set, PostgreSQL returns 0 rows or fails check constraints, making accidental data leakage impossible even if application code omits an `orgId` filter.

## Consequences

### Positive:
- **Zero Accidental Leakage**: A developer writing a raw SQL query or forgetting a `where` clause cannot query another tenant's records.
- **Operational Simplicity**: Single migration runner and single database pool rather than maintaining hundreds of tenant schemas.
- **Auditable Boundary**: Security audits verify SQL policies in database migrations rather than inspecting thousands of application endpoint lines.

### Negative / Trade-offs:
- Prisma requires `$transaction` with interactive transaction runners to maintain session configuration per request.
- Superuser roles (`postgres`) bypass RLS unless `FORCE ROW LEVEL SECURITY` is applied to table owners. We mitigated this by configuring restricted application roles (`compass_app`).
