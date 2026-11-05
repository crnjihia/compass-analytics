# 0008 – Kubernetes Deployment Enhancements

## Context

The initial deployment manifests for Compass provided basic probes and resource requests, but lacked Horizontal Pod Autoscalers (HPA) for the ingest service and a unified alerting strategy. In production environments autoscaling is essential to handle traffic spikes from M‑Pesa webhook bursts and to keep latency low. Additionally, operators need alert rules for API latency, Redis stream lag, and service health.

## Decisions
1. **Add HPA for Ingest** – Mirrors the existing HPA for the web tier, scaling between 2‑6 replicas based on CPU (70 %) and memory (80 %).
2. **Prometheus Alert Rules** – Introduced a `ConfigMap` (`prometheus-alert-rules`) containing alerts for:
   - High p95 API latency on the web service.
   - Redis stream length exceeding 1000 (potential consumer lag).
   - Ingest service down (`up == 0`).
3. **Expose Metrics** – Added `/api/metrics` endpoint to the Next.js app exposing `prom-client` default metrics. Ingest already exposed its own `/metrics` port.
4. **Consistent Namespace** – All resources live in the `compass` namespace (except monitoring assets in `monitoring`).

## Impact
- No API‑breaking changes; only operational enhancements.
- Deployments automatically scale under load, improving resilience.
- Alerts give operators early visibility into performance regressions.

## Alternatives Considered
- **Cluster‑Autoscaler only** – Rejected because pod‑level scaling is needed for bursty workloads.
- **Custom Metrics HPA** – Not required; CPU/Memory provide sufficient signals for now.

## Implementation Notes
- HPA manifests placed under `deploy/k8s/base/ingest/hpa.yaml`.
- Alert rules are loaded by the Prometheus server via `prometheus-configmap.yaml` which includes `alert.yaml` as a file mount.
- The metrics route uses `prom-client` and is declared `dynamic` to avoid caching.
