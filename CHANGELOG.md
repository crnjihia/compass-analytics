# Changelog

All notable changes to Compass Analytics are documented in this file in adherence to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-17

### Added
- **Multi-Tenant Database Architecture**:
  - PostgreSQL 16 schema with engine-enforced Row-Level Security (`current_setting('app.org_id', true)`).
  - Prisma extension `createTenantDb(orgId)` with automatic `SET LOCAL app.org_id` transaction boundaries.
  - Realistic seed fixtures for Kenyan retail enterprises: *Baraka Hardware Supplies* and *Nairobi Fresh Grocers*.
- **Domain API & Authentication**:
  - Full tRPC v10 router suite: `revenue`, `customers`, `inventory`, `connection`, `health`.
  - Clerk Multi-Tenant Authentication integration with Svix webhook synchronization.
  - AES-256-GCM encryption with 96-bit nonces for Safaricom Daraja secrets.
  - Tenant-salted HMAC-SHA256 MSISDN masking and cohort tracking.
- **Analytics Dashboard UI**:
  - Dark-mode glassmorphic interface with Tailwind CSS and Outfit typography.
  - Recharts revenue area charts with interactive timeframe toggles (1H, 1D, 1W, 1M).
  - Customer retention cohort heatmap and top customer spending profiles.
  - Stockout run-rate inventory velocity forecasting with interactive adjustment and CSV reconciliation modals.
  - Instant tenant switcher for seamless multi-organization demonstration.
- **High-Throughput Go Ingest Microservice**:
  - Dedicated Go 1.23 service (`services/ingest`) using Chi router for sub-3ms Daraja C2B webhooks (`/validation`, `/confirmation`).
  - Redis Streams (`mpesa:txns`) asynchronous buffering with consumer group worker pools.
  - Atomic Redis transaction deduplication (`dedup:mpesa:{org_id}:{trans_id}`).
  - Standalone M-Pesa payment traffic simulator CLI (`cmd/simulator`).
- **Real-Time Streaming**:
  - Server-Sent Events (SSE) route handler subscribing to Redis Pub/Sub (`org:{id}:txn`).
  - Client-side `useLiveRevenue` hook with 15s keepalive heartbeats and 5s polling fallback.
  - Real-time toast notifications banner for incoming customer transactions.
- **Caching & Stampede Protection**:
  - `SingleFlight` concurrency coalescing barrier preventing database connection pool exhaustion.
  - SuperJSON serialization preserving 64-bit integer cents (`BigInt`) and native `Date` types.
  - $O(1)$ tenant-wide cache invalidation via atomic version counter increments (`INCR org:{id}:cache_version`).
- **Terraform Infrastructure (AWS Cape Town `af-south-1`)**:
  - Multi-AZ VPC across 3 availability zones with dedicated public, private, and isolated database subnets.
  - RDS PostgreSQL 16 Multi-AZ instance with auto-scaling gp3 storage, KMS encryption, and slow query logging.
  - ElastiCache Redis 7 replication group with multi-AZ automatic failover, in-transit encryption, and `volatile-lru` eviction.
  - EKS 1.30 managed cluster with KMS envelope encryption and IAM Roles for Service Accounts (IRSA).
  - Centralized AWS Secrets Manager integration.
- **Cloud-Native Deployment & Observability**:
  - Production multi-stage Dockerfiles for Next.js web application and Go ingest service.
  - Kubernetes base manifests and environment overlays for staging and production via Kustomize.
  - Zero-trust NetworkPolicies and Horizontal Pod Autoscalers (HPA).
  - Prometheus alerting rules for Daraja webhook 5xx error rates, p99 latency SLA (> 250ms), and stream queue backlog.
  - Provisioned Grafana overview dashboard and native Kubernetes ServiceMonitors.
  - GitHub Actions CI/CD matrix and multi-arch container publishing to GHCR.
- **Architecture Documentation & ADRs**:
  - 6 comprehensive Architecture Decision Records (`0001` through `0006`).
  - Comprehensive system architecture documentation with Mermaid diagrams, developer guide, and empirical performance benchmarks.
