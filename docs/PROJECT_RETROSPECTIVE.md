# Compass Analytics - Project Retrospective

## Executive Summary

Compass Analytics was designed and engineered from the ground up as a production-grade, multi-tenant business analytics SaaS tailored for Kenyan small and medium enterprises (SMEs). Over 12 development phases, the platform evolved into a robust monorepo uniting a Next.js 14 frontend, a high-throughput Go ingestion microservice, PostgreSQL Row-Level Security isolation, Redis Streams asynchronous queuing, Terraform infrastructure, Kubernetes Kustomize deployments, and comprehensive Prometheus/Grafana observability.

---

## What Was Built

| Layer | Implementation Highlights |
|---|---|
| **Frontend & UI** | Next.js 14 App Router, Tailwind CSS, Recharts analytics, dark glassmorphic design system, real-time SSE payment notifications, tenant switcher |
| **Backend & API** | tRPC v10 end-to-end typed RPC, Clerk auth with Svix webhook sync, SingleFlight stampede protection, SuperJSON serializer |
| **Data & Isolation** | PostgreSQL 16 with engine-enforced Row-Level Security (`current_setting('app.org_id', true)`), Prisma ORM extension, 64-bit integer KES cents |
| **High-Throughput Ingest** | Go 1.23 microservice (`services/ingest`), Chi router, sub-3ms Daraja C2B webhooks, Redis Streams consumer groups, deduplication cache |
| **Real-Time Streaming** | Server-Sent Events (SSE) route subscribing to Redis Pub/Sub with automatic 15s heartbeats and 5s polling fallback |
| **Infrastructure as Code** | Terraform modules for AWS Cape Town (`af-south-1`): Multi-AZ VPC, RDS PostgreSQL 16, ElastiCache Redis 7, EKS 1.30, Secrets Manager, and KMS |
| **Cloud Native Deployment** | Docker multi-stage images, Kubernetes base manifests, zero-trust NetworkPolicies, HPA autoscalers, staging & production Kustomize overlays |
| **Observability** | Prometheus alerting rules (SLA, error rate, queue backlog), provisioned Grafana overview dashboard, Kubernetes ServiceMonitors |

---

## Key Architectural Trade-Offs

### 1. Engine-Level Row-Level Security vs Multi-Database
- **Decision**: Enforce tenancy via PostgreSQL RLS rather than separate databases.
- **Why**: Eliminates the operational complexity of managing connection pools, database migrations, and schema drift across hundreds of tenant databases.
- **Trade-off**: Requires strict transaction-scoped execution (`SET LOCAL app.org_id = ?`) and Prisma interactive transaction wrappers.

### 2. Polyglot Architecture (Go Ingest + TypeScript Web)
- **Decision**: Carve out the Daraja C2B webhook ingest into a dedicated Go microservice.
- **Why**: Safaricom webhooks require immediate sub-250ms acknowledgments. Go's lightweight concurrency and fast startup provide predictable sub-5ms latencies and < 15MB RAM footprint per container.
- **Trade-off**: Adds Go tooling and cross-language type synchronization to the repository.

### 3. Redis Streams vs Apache Kafka
- **Decision**: Adopt Redis Streams with consumer groups for transaction queueing.
- **Why**: Drastically reduces infrastructure footprint. Redis already handles single-flight caching and SSE pub/sub, so utilizing Streams avoids operating heavy Kafka brokers and ZooKeeper.
- **Trade-off**: Memory capacity must be monitored with explicit stream length truncation (`MAXLEN ~ 100000`).

### 4. 64-bit Integer KES Cents vs Float / Decimal
- **Decision**: Represent all monetary figures as integer cents (`BigInt`).
- **Why**: Completely eliminates floating-point precision errors (e.g. `0.1 + 0.2 !== 0.3`).
- **Trade-off**: Requires SuperJSON transformers across the wire since native `JSON.stringify` does not support `BigInt`.

---

## What Would Be Done Differently With More Time

1. **OLAP Storage Tier (ClickHouse / DuckDB)**:
   - While PostgreSQL RLS with hourly rollups handles millions of rows comfortably, analyzing multi-year customer cohorts across tens of millions of retail records would benefit from a column-oriented OLAP engine.
2. **OpenTelemetry Distributed Tracing**:
   - Trace context propagation (W3C TraceContext headers) between the Go ingestion microservice and the Next.js SSE streamer to track transaction journeys end-to-end.
3. **AWS Local Zone Deployment in Nairobi**:
   - Deploying edge ingress nodes into the AWS Nairobi Local Zone (`af-south-1-nbo-1`) to reduce network round-trip latency to Safaricom's data centers down to single-digit milliseconds.

---

## Lessons Learned

- **Decouple early**: Safaricom's webhook retry storms can quickly take down an entire platform if webhook ingestion shares database transactions with synchronous UI traffic. Asynchronous buffering into an in-memory stream makes the system resilient to database spikes.
- **Enforce boundaries in the engine**: Application-level tenant filters (`where: { orgId }`) are prone to developer oversight. Moving tenant boundaries into database RLS transforms data isolation from a hopeful convention into a mathematical certainty.
