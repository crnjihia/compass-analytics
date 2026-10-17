---
number: 0003
title: Dedicated Go Microservice for Daraja C2B Webhook Ingestion
status: accepted
date: 2026-10-17
---

## Context

M-Pesa Daraja C2B (Customer to Business) webhooks represent a high-throughput, latency-critical interface. Safaricom requires webhooks (`/mpesa/c2b/validation` and `/mpesa/c2b/confirmation`) to respond with a valid JSON payload in under 250 milliseconds. If the webhook times out or returns a non-200 status code, Safaricom initiates automatic retries, which can cause stampeding herd failures during high-traffic spikes (e.g. lunchtime or evening retail rushes).

Options considered:
1. **Next.js API Route Handlers**: Handle webhooks directly in Node.js serverless/standalone routes.
2. **Dedicated Go Microservice**: A standalone, compiled binary using Go Chi router, goroutine consumer groups, and Redis Streams.

## Decision

We chose a **dedicated Go microservice** (`services/ingest`) for handling Daraja webhooks and Redis Stream queuing.

Key design points:
- **Instant Webhook Acknowledgment**: The HTTP handler performs minimal work: validating JSON format, pushing raw transaction data into a Redis Stream (`mpesa:txns`), and immediately returning `{"ResultCode": 0, "ResultDesc": "Success"}` to Safaricom in under 3ms.
- **Background Worker Goroutines**: Worker pools consume from Redis Streams via Consumer Groups (`mpesa_workers`), deduplicate transaction IDs (`dedup:mpesa:{org_id}:{trans_id}`), and persist to PostgreSQL within an RLS transaction (`SET LOCAL app.org_id`).
- **Memory Footprint**: The Go runtime consumes ~15MB of RAM per container compared to ~120MB+ for a Node.js runtime, permitting high horizontal scaling on Kubernetes.

## Consequences

### Positive:
- Peak Daraja webhook throughput sustains > 5,000 req/s per node with sub-5ms response times.
- Decouples external payment webhook ingestion from web frontend deployment cycles.
- Prometheus metrics (`mpesa_webhook_duration_seconds`, `mpesa_queue_depth`) provide real-time visibility into Safaricom gateway health.

### Negative / Trade-offs:
- Polyglot repository (TypeScript + Go) requires tooling for both language ecosystems in CI pipelines and developer environments.
