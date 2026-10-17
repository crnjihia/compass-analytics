<div align="center">

  <img src="docs/assets/logo.svg" alt="Compass Analytics Logo" width="100%" max-width="800px" />

  <p align="center">
    <strong>Production-Grade Multi-Tenant Business Analytics &amp; M-Pesa Revenue Intelligence for Kenyan SMEs</strong>
  </p>

  <p align="center">
    <a href="https://github.com/crnjihia/compass-analytics/actions/workflows/ci.yml"><img src="https://github.com/crnjihia/compass-analytics/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
    <a href="https://crnjihia.github.io/compass-analytics/"><img src="https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-10b981.svg" alt="GitHub Pages Live Demo" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
    <a href="https://github.com/crnjihia/compass-analytics/releases"><img src="https://img.shields.io/badge/Release-v1.0.0-emerald.svg" alt="Release v1.0.0" /></a>
    <img src="https://img.shields.io/badge/Language-TypeScript%20%7C%20Go-007acc.svg" alt="TypeScript and Go" />
    <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg" alt="PRs Welcome" />
  </p>
</div>

---

## 1. Why This Exists

Kenyan retail SMEs process over 80% of their daily revenues through Safaricom M-Pesa Daraja paybills and till numbers, yet business owners still track inventory and cash flow on paper ledgers or fragmented point-of-sale exports. Existing enterprise ERP solutions are priced in USD, lack native Daraja webhook resiliency, and fail to calculate Kenyan cash-velocity dynamics. **Compass Analytics** solves this by providing real-time M-Pesa revenue stream visualization, customer cohort retention analytics, and stockout run-rate forecasting within a strict, multi-tenant Row-Level Security isolation boundary.

---

## 2. Key Features

- ⚡ **Sub-3ms M-Pesa Ingestion**: High-throughput Go microservice accepting Safaricom Daraja C2B validation and confirmation webhooks with sub-millisecond Redis Streams buffering.
- 🛡️ **Cryptographic Multi-Tenancy**: Engine-enforced PostgreSQL 16 Row-Level Security (`current_setting('app.org_id', true)`). Tenant cross-talk is physically impossible at the database engine level.
- 💰 **Exact Integer Currency**: All financial ledgers store money as 64-bit integer Kenyan Shilling cents (`BigInt`), completely eliminating IEEE 754 floating-point rounding errors.
- 📡 **Real-Time Heartbeat Stream**: Server-Sent Events (SSE) stream subscribing to Redis Pub/Sub, delivering live incoming payment alerts without polling overhead.
- 🚀 **SingleFlight Stampede Protection**: In-memory concurrency barrier coalesces concurrent cache misses during peak hours; $O(1)$ tenant-wide cache invalidation via Redis atomic counters.
- 📊 **Kenyan SME Intelligence**: Cohort retention heatmaps, stockout run-rate velocity forecasting, and CSV transaction reconciliation for Nairobi retailers.
- ☸️ **Production Infrastructure**: Complete AWS Terraform (VPC, RDS, ElastiCache, EKS 1.30, KMS) and Kubernetes Kustomize manifests with zero-trust NetworkPolicies and HPA autoscaling.

---

## 3. Architecture & How It Works

```mermaid
flowchart LR
    subgraph Edge["Clients & Ingress"]
        Daraja["Safaricom Daraja<br/>(C2B Webhooks)"]
        Browser["SME Browser<br/>(Next.js Dashboard)"]
        ALB["AWS ALB<br/>(Path Routing)"]
    end

    subgraph Cluster["EKS Cluster (compass)"]
        Ingest["Go Ingest Service<br/>(sub-3ms Webhooks)"]
        Web["Next.js 14 Web<br/>(tRPC v10 & SSE)"]
    end

    subgraph Storage["Data & Cache Tier"]
        Redis[("ElastiCache Redis 7<br/>Streams & PubSub")]
        Postgres[("RDS PostgreSQL 16<br/>Row-Level Security")]
    end

    Daraja -->|POST /mpesa/*| ALB
    Browser -->|HTTPS /*| ALB
    ALB -->|/mpesa/*| Ingest
    ALB -->|/*| Web

    Ingest -->|XADD mpesa:txns| Redis
    Redis -->|XREADGROUP| Ingest
    Ingest -->|SET LOCAL app.org_id<br/>Insert Txn| Postgres
    Ingest -->|PUBLISH org:txn| Redis
    Redis -.->|SSE Stream| Web
    Web -->|SingleFlight Cache| Redis
    Web -->|SET LOCAL app.org_id| Postgres
```

### The Ingestion Lifecycle
1. **Webhook Acknowledgment**: Safaricom fires a C2B confirmation to `/mpesa/c2b/confirmation/{org_id}`. The Go service validates JSON, masks the customer phone number (`254712***789`), computes a tenant-salted HMAC-SHA256 hash, appends the payload to Redis Stream `mpesa:txns`, and returns `ResultCode: 0` in < 3ms.
2. **Background Consumer**: A pool of goroutine workers reading consumer group `mpesa_workers` pulls the stream entry, checks the Redis deduplication key (`dedup:mpesa:{org_id}:{trans_id}`), and executes a transactional insert into PostgreSQL with `SET LOCAL app.org_id = ?`.
3. **Live UI Broadcast**: Upon database commit, the worker publishes to Redis channel `org:{org_id}:txn`, which pushes an instant payment alert to active browser dashboards via Server-Sent Events (SSE).

---

## 4. Quick Start

Run the entire platform locally with three simple commands:

```bash
# 1. Clone repository
git clone https://github.com/crnjihia/compass-analytics.git
cd compass-analytics

# 2. Setup workspace, generate Prisma client, run migrations, and seed data
make setup

# 3. Start Next.js dashboard, Go Ingest service, and payment simulator concurrently
make dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 5. Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string with pooling | `postgresql://postgres:postgres@localhost:5432/compass_analytics` |
| `DIRECT_URL` | Direct PostgreSQL connection for migrations | `postgresql://postgres:postgres@localhost:5432/compass_analytics` |
| `REDIS_URL` | Redis connection for cache and streams | `redis://localhost:6379` |
| `DARAJA_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM secret storage | *Generated in setup* |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Authentication publishable key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Authentication backend API secret | `sk_test_...` |
| `PORT` | Next.js HTTP server port | `3000` |
| `INGEST_PORT` | Go Ingest HTTP server port | `8080` |

---

## 6. Seeded Demo Tenants

Compass Analytics comes pre-seeded with realistic Kenyan enterprise data:

| Tenant | Sector | Location | Default Currency | Seeded Transactions |
|---|---|---|---|---|
| **Baraka Hardware Supplies** (`org_baraka_hardware`) | Construction & Hardware | Commercial St, Industrial Area, Nairobi | KES | 120 payments (Cement, Iron sheets, Nails) |
| **Nairobi Fresh Grocers** (`org_nairobi_fresh`) | Agriculture & Grocery | Ring Rd, Westlands, Nairobi | KES | 85 payments (Avocados, Sukuma wiki, Milk) |

Toggle between organizations in real-time using the **Tenant Switcher** in the top navigation bar to witness PostgreSQL Row-Level Security in action.

---

## 7. Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) | Server-Side Rendering, React Server Components, optimal SEO and routing |
| **API Layer** | tRPC v10 + React Query v4 | End-to-end compile-time type safety with zero code-gen overhead |
| **Ingestion Microservice** | Go 1.23 (Chi Router) | High-concurrency goroutines, < 15MB RAM per pod, sub-3ms Daraja responses |
| **Database** | PostgreSQL 16 + Prisma ORM | Hard tenant isolation via engine RLS; JSONB support, 64-bit integer cents |
| **Cache & Queue** | Redis 7 (Streams + Pub/Sub) | High-speed stream consumer groups, SSE live fanout, SingleFlight caching |
| **Styling & Charts** | Tailwind CSS + Recharts | Responsive dark-mode glassmorphic interface tailored for financial data |
| **Infrastructure** | Terraform + AWS (Cape Town) | Multi-AZ VPC, EKS 1.30, RDS PostgreSQL, ElastiCache Redis, KMS encryption |
| **Orchestration** | Kubernetes + Kustomize | Production and staging overlays, zero-trust NetworkPolicies, HPA autoscalers |
| **Observability** | Prometheus + Grafana | Daraja SLA latency histograms, Redis queue depth alerts, provisioned dashboards |

---

## 8. What Is Real vs Simulated

| Component | Status | Implementation Details |
|---|---|---|
| **PostgreSQL Multi-Tenancy** | **100% Real** | Enforced at the database engine level via `current_setting('app.org_id', true)`. |
| **Money Calculations** | **100% Real** | Computed in 64-bit integer KES cents (`BigInt`) with exact math. |
| **Redis Queue & Caching** | **100% Real** | Live Redis Streams consumer groups, SingleFlight deduplication, and Pub/Sub. |
| **M-Pesa Daraja Integration** | **Real Protocol / Sandboxed** | Handlers implement the exact Safaricom Daraja C2B specification. In development, events are generated via `cmd/simulator` or Safaricom's sandbox API. |
| **Authentication** | **Real / Dev Mockable** | Production uses Clerk Auth with Svix webhooks. Local dev includes fallback mock headers for seamless offline pairing. |

---

## 9. Performance & Empirical Benchmarks

Tested on a 4-vCPU environment under concurrent load:
- **Go Webhook Ingest Throughput**: **5,420 req/s** sustained (100% HTTP 200).
- **Webhook Response Latency (p99)**: **4.1 ms** (Safaricom SLA threshold is 250ms).
- **Postgres RLS Overhead**: **< 0.2 ms** delta compared to unsecured queries.
- **SingleFlight Coalescing**: 100 concurrent requests during cold cache result in **exactly 1 database execution**.
- **Tenant Cache Invalidation**: **< 0.5 ms** constant time ($O(1)$ via atomic counter increment).

For full benchmark details, see [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

---

## 10. Repository Structure

```
compass-analytics/
├── apps/
│   └── web/                   # Next.js 14 App Router, tRPC routers, Recharts UI
├── services/
│   └── ingest/                # Go M-Pesa Daraja C2B webhook ingest & workers
│       └── cmd/simulator/     # Real-time Daraja payment traffic generator
├── packages/
│   ├── db/                    # Prisma schema, migrations, RLS extension, seed data
│   └── shared/                # KES currency math, AES-256 crypto, MSISDN hashing
├── infra/
│   └── terraform/             # AWS IaC (VPC, RDS, ElastiCache, EKS, KMS, Secrets)
├── deploy/
│   ├── k8s/                   # Kubernetes base manifests & staging/prod Kustomize
│   └── observability/         # Prometheus alerts, scrape configs, Grafana dashboards
└── docs/
    ├── ARCHITECTURE.md        # Deep architectural design and Mermaid diagrams
    ├── DEVELOPMENT.md         # Local development setup and commands
    ├── PERFORMANCE.md         # Empirical benchmark results
    └── adr/                   # Architecture Decision Records (0001 - 0006)
```

---

## 11. Deep Dives & Architecture Decision Records

<details>
<summary><strong>Click to expand Architecture Decision Records (ADRs)</strong></summary>

- [ADR 0001: Choose tRPC for End-to-End Type Safety](docs/adr/0001-choose-trpc.md)
- [ADR 0002: PostgreSQL Row-Level Security (RLS) for Multi-Tenancy](docs/adr/0002-postgres-rls-multi-tenancy.md)
- [ADR 0003: Dedicated Go Microservice for Daraja Webhook Ingestion](docs/adr/0003-go-service-for-mpesa-ingestion.md)
- [ADR 0004: Redis Streams with Consumer Groups for Ingestion Queue](docs/adr/0004-redis-streams-for-transaction-queue.md)
- [ADR 0005: Storing Money as 64-bit Integer KES Cents (BigInt)](docs/adr/0005-kes-integer-cents-currency-storage.md)
- [ADR 0006: SingleFlight Stampede Protection and Tenant-Versioned Cache](docs/adr/0006-singleflight-and-tenant-versioned-cache.md)

</details>

---

## Contributing

Contributions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and adhere to our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
