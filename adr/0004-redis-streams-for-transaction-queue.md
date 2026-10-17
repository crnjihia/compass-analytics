---
number: 0004
title: Redis Streams with Consumer Groups for Ingestion Queue
status: accepted
date: 2026-10-17
---

## Context

Decoupling high-velocity Daraja webhook arrivals from database write availability requires an asynchronous message queue. 

Options considered:
1. **Apache Kafka**: High throughput, persistent log.
2. **RabbitMQ**: Advanced AMQP routing and acknowledgments.
3. **AWS SQS**: Managed cloud queue.
4. **Redis Streams (with Consumer Groups)**: Append-only log built into Redis 5+.

## Decision

We chose **Redis Streams with Consumer Groups** (`mpesa:txns`).

Rationale:
- **Low Operational Complexity**: Compass Analytics already utilizes Redis for single-flight query caching and Server-Sent Events (SSE) pub/sub. Adopting Redis Streams eliminated the need to operate a separate Kafka cluster or ZooKeeper/KRaft quorum.
- **Consumer Group Semantics**: `XREADGROUP` provides consumer load balancing, at-least-once delivery, explicit message acknowledgments (`XACK`), and visibility into pending entry lists (PEL) via `XPENDING`.
- **Sub-Millisecond Queue Latency**: `XADD` operations consistently complete in under 0.5 milliseconds.
- **Direct Queue Depth Metric**: Stream length (`XLEN`) and consumer lag provide real-time Prometheus metrics (`mpesa_queue_depth`) for Kubernetes HPA autoscaling.

## Consequences

### Positive:
- Single data store (Redis) powers caching, transaction buffering, and real-time SSE pub/sub.
- Rapid recovery from PostgreSQL maintenance windows without dropping Safaricom webhooks.

### Negative / Trade-offs:
- In-memory data store requires monitoring memory sizing to prevent OOM eviction. We configured explicit `MAXLEN ~ 100000` stream truncation policies and persistent AOF (Append-Only File) logging.
