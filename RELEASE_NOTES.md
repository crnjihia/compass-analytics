# Compass Analytics v1.0.0 Release Notes

**Compass Analytics** is a production-grade, multi-tenant business analytics SaaS engineered specifically for Kenyan SMEs to monitor real-time M-Pesa revenue, customer cohort retention, and inventory velocity.

---

## Highlights

- ⚡ **Sub-3ms M-Pesa Ingestion**: Dedicated Go 1.23 microservice accepting Safaricom Daraja C2B webhooks with sub-millisecond Redis Streams buffering and consumer group deduplication.
- 🛡️ **PostgreSQL Row-Level Security**: Hard tenant isolation boundary at the database engine level (`current_setting('app.org_id', true)`). Tenant cross-talk is physically impossible even under code bugs.
- 💰 **Exact Integer Currency Math**: All financial transactions store money as 64-bit integer Kenyan Shilling cents (`BigInt`), completely eliminating IEEE 754 floating-point rounding errors.
- 📡 **Real-Time Heartbeat Stream**: Server-Sent Events (SSE) route streaming live incoming transactions from Redis Pub/Sub with automatic 15s heartbeats and 5s polling fallback.
- 🚀 **SingleFlight Stampede Protection**: In-memory concurrency barrier coalesces concurrent cache misses during traffic spikes; $O(1)$ tenant-wide cache invalidation via atomic version increments.
- 📊 **Kenyan SME Intelligence**: Cohort retention heatmaps, stockout run-rate velocity forecasting, and CSV transaction reconciliation for Nairobi retailers.
- ☸️ **Full Production Infrastructure**: Complete AWS Terraform (VPC, RDS, ElastiCache, EKS 1.30, KMS) and Kubernetes Kustomize manifests with zero-trust NetworkPolicies and HPA autoscaling.
- 📈 **Observability**: Prometheus alerting rules for Daraja webhook 5xx error rates, p99 latency SLA (> 250ms), and stream queue backlog, paired with a provisioned Grafana dashboard.

---

## Quickstart

```bash
# Clone and setup
git clone https://github.com/crnjihia/compass-analytics.git
cd compass-analytics
make setup

# Run tests (Unit, Integration, RLS Isolation, Go Ingest)
make test

# Start local full-stack development environment
make dev
```

Access the dashboard at [http://localhost:3000](http://localhost:3000).

---

## Test Verification Summary
- **Database RLS Isolation Tests**: 7/7 Passed (`packages/db`)
- **Shared Currency & Crypto Tests**: 6/6 Passed (`packages/shared`)
- **Web API & Caching Tests**: 32/32 Passed (`apps/web`)
- **Go Ingest & Worker Tests**: 100% Passed (`services/ingest`)
- **Kubernetes Kustomize Builds**: Base, Staging, and Production validated cleanly with `kubectl kustomize`
