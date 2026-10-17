# Compass Analytics - Local Development Guide

This guide outlines setup instructions, local development commands, environment configuration, and debugging workflows for Compass Analytics.

---

## 1. Prerequisites

- **Node.js**: `v20.x` or later
- **pnpm**: `v9.x` (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **Go**: `v1.22` or `v1.23` (for `services/ingest` and payment simulator)
- **Docker & Docker Compose**: (Or native PostgreSQL 16 + Redis 7)
- **kubectl**: (Optional, for verifying Kustomize manifests locally)

---

## 2. Quick Setup (3 Commands)

```bash
# 1. Clone repository
git clone https://github.com/crnjihia/compass-analytics.git
cd compass-analytics

# 2. Install workspace dependencies and setup local database
make setup

# 3. Start local development stack (Next.js, Go Ingest, Simulator)
make dev
```

The frontend dashboard will be available at [http://localhost:3000](http://localhost:3000).

---

## 3. Environment Configuration

Copy the sample environment file to `.env`:
```bash
cp .env.example .env
```

Key environment parameters:
| Parameter | Default (Local) | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/compass_analytics` | PostgreSQL connection string |
| `DIRECT_URL` | `postgresql://postgres:postgres@localhost:5432/compass_analytics` | Direct database connection for migrations |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for cache and streams |
| `DARAJA_ENCRYPTION_KEY` | 32-byte hex string | AES-256-GCM key for encrypting M-Pesa secrets |
| `PORT` | `3000` | Next.js server port |
| `INGEST_PORT` | `8080` | Go ingest HTTP port |

---

## 4. Make Commands Reference

| Command | Action |
|---|---|
| `make setup` | Installs pnpm packages, generates Prisma client, runs migrations, and seeds Kenyan demo data |
| `make dev` | Starts Next.js app (`:3000`), Go ingest service (`:8080`), and background workers concurrently |
| `make test` | Runs unit, integration, and RLS isolation tests across all workspaces |
| `make lint` | Executes ESLint and TypeScript type checking |
| `make build` | Compiles production builds for `@compass/shared`, `@compass/db`, `@compass/web`, and Go ingest |
| `make seed` | Re-seeds database with realistic Kenyan SME datasets |
| `make simulate` | Launches the interactive M-Pesa payment simulator sending realistic C2B webhooks |
| `make compose-up` | Launches containerized PostgreSQL 16, Redis 7, Prometheus, and Grafana |
| `make compose-down` | Tears down local Docker Compose services |

---

## 5. Simulating Real-Time M-Pesa Payments

Compass Analytics includes a dedicated CLI simulator that fires realistic Safaricom Daraja C2B webhooks with random Kenyan phone numbers, customer names, and KES amounts:

```bash
# Run 20 simulated payments across active tenants at 200ms intervals
cd services/ingest
go run cmd/simulator/main.go -n 20 -interval 200ms
```

Watch the Next.js dashboard update in real-time via Server-Sent Events (SSE) as incoming payments arrive!

---

## 6. Multi-Tenant Testing & Debugging

Two pre-configured tenants are seeded by default:
1. **Baraka Hardware Supplies** (`org_baraka_hardware`): High-volume hardware retailer in Industrial Area, Nairobi.
2. **Nairobi Fresh Grocers** (`org_nairobi_fresh`): Fresh produce distribution chain in Westlands & City Park.

Use the tenant switcher in the dashboard navigation bar to toggle between organizations and observe Row-Level Security in action. All revenue cards, customer cohort tables, and inventory velocity metrics instantly scope to the selected tenant without data bleed.
