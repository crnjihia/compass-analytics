package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	WebhookRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mpesa_webhook_requests_total",
			Help: "Total number of M-Pesa webhook requests received by endpoint and organization",
		},
		[]string{"org_id", "endpoint", "status"},
	)

	WebhookDurationSeconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "mpesa_webhook_duration_seconds",
			Help:    "Latency of M-Pesa webhook processing in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"endpoint"},
	)

	QueueDepth = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "mpesa_queue_depth",
			Help: "Current depth (pending length) of Redis stream mpesa:txns",
		},
	)

	TransactionsProcessedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mpesa_transactions_processed_total",
			Help: "Total number of M-Pesa transactions processed by background worker",
		},
		[]string{"org_id", "status"},
	)
)
