# Observability for Compass Analytics

## Metrics
- **Next.js API metrics** are exposed at `/api/metrics` using the `prom-client` library. These include default Go-like metrics (process_cpu_seconds_total, process_resident_memory_bytes, nodejs_eventloop_lag_seconds) and custom counters for request latency.
- **Ingest service metrics** are served on port `9100` (`/metrics`) via the Prometheus client library integrated in Go.

## Grafana Dashboard
A ready‑to‑use Grafana dashboard (`grafana-dashboard.json`) visualises:
- Web request rate (`rate(http_requests_total{job="compass-web"}[5m])`).
- p95 latency (`histogram_quantile(0.95, ...)`).
- Redis stream length (`redis_stream_length{job="compass-ingest"}`).

## Alerting
Critical alerts are defined in `deploy/k8s/base/alert.yaml` and cover:
- **High API Latency** (p95 > 300 ms).
- **Redis Stream Lag** (stream length > 1000).
- **Ingest Service Down** (no scrape hits).

Prometheus scrapes the web and ingest metrics, evaluates the alert rules and forwards alerts to the configured notification channel (Slack, email, etc.).

## Local Development
Run `make dev` and access `http://localhost:3000/api/metrics` to view raw Prometheus exposition format. You can also query the ingest metrics at `http://localhost:8080/metrics`.
