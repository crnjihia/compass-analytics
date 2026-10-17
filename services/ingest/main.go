package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"compass-analytics/ingest/internal/metrics"
	"compass-analytics/ingest/internal/mpesa"
	"compass-analytics/ingest/internal/queue"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

func main() {
	ingestPort := getEnv("INGEST_PORT", "8080")
	metricsPort := getEnv("METRICS_PORT", "9100")
	redisURL := getEnv("REDIS_URL", "redis://172.26.192.86:6379")
	dbURL := getEnv("DATABASE_URL", "postgresql://compass_app:compass_secret@172.26.192.86:5433/compass_analytics?sslmode=disable")

	log.Println("🚀 Starting Compass Analytics Daraja Ingestion Service...")

	// 1. Connect to Redis
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("❌ Invalid Redis URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ Redis ping warning: %v (continuing)", err)
	} else {
		log.Println("✅ Connected to Redis successfully.")
	}

	// 2. Connect to PostgreSQL (Non-superuser compass_app with RLS)
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("❌ Invalid PostgreSQL URL: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Printf("⚠️ PostgreSQL ping warning: %v (continuing)", err)
	} else {
		log.Println("✅ Connected to PostgreSQL successfully (role: compass_app).")
	}

	// 3. Initialize Redis Stream Consumer Group & Worker
	worker := queue.NewWorker(rdb, db, fmt.Sprintf("ingest-worker-%d", os.Getpid()))
	if err := worker.InitConsumerGroup(ctx); err != nil {
		log.Printf("⚠️ Consumer group init note: %v\n", err)
	}
	go worker.Start(ctx)
	defer worker.Stop()

	// 4. Setup Ingest HTTP Router (chi)
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))

	// Health check
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok","service":"compass-ingest"}`)
	})

	// Also expose /metrics on main router for convenience
	r.Handle("/metrics", promhttp.Handler())

	// Daraja C2B Validation Endpoint
	// Safaricom sends customer payment attempt here before processing
	r.Post("/mpesa/c2b/validation/{org_id}", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		orgID := chi.URLParam(r, "org_id")

		metrics.WebhookRequestsTotal.WithLabelValues(orgID, "validation", "200").Inc()
		metrics.WebhookDurationSeconds.WithLabelValues("validation").Observe(time.Since(start).Seconds())

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mpesa.C2BResponse{
			ResultCode: 0,
			ResultDesc: "Accepted",
		})
	})

	// Daraja C2B Confirmation Endpoint
	// Safaricom posts confirmed payment callback here
	r.Post("/mpesa/c2b/confirmation/{org_id}", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		orgID := chi.URLParam(r, "org_id")

		var payload mpesa.C2BCallbackPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			metrics.WebhookRequestsTotal.WithLabelValues(orgID, "confirmation", "400").Inc()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(mpesa.C2BResponse{
				ResultCode: 1,
				ResultDesc: "Rejected - Invalid JSON payload",
			})
			return
		}

		// Enqueue to Redis Stream for high-throughput asynchronous processing
		_, err := queue.Enqueue(r.Context(), rdb, orgID, &payload)
		if err != nil {
			log.Printf("❌ Failed to enqueue transaction %s for %s: %v\n", payload.TransID, orgID, err)
			metrics.WebhookRequestsTotal.WithLabelValues(orgID, "confirmation", "500").Inc()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(mpesa.C2BResponse{
				ResultCode: 1,
				ResultDesc: "Internal Server Error",
			})
			return
		}

		metrics.WebhookRequestsTotal.WithLabelValues(orgID, "confirmation", "200").Inc()
		metrics.WebhookDurationSeconds.WithLabelValues("confirmation").Observe(time.Since(start).Seconds())

		// Immediately acknowledge receipt to Safaricom Daraja API
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mpesa.C2BResponse{
			ResultCode: 0,
			ResultDesc: "Accepted",
		})
	})

	// 5. Dedicated Prometheus Metrics Server (:9100)
	metricsServer := &http.Server{
		Addr:    ":" + metricsPort,
		Handler: promhttp.Handler(),
	}
	go func() {
		log.Printf("📊 Prometheus metrics listening on :%s/metrics\n", metricsPort)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Metrics server error: %v\n", err)
		}
	}()

	// 6. Ingest HTTP Server (:8080)
	ingestServer := &http.Server{
		Addr:    ":" + ingestPort,
		Handler: r,
	}

	go func() {
		log.Printf("⚡ Ingest webhook server listening on :%s\n", ingestPort)
		if err := ingestServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Ingest server error: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down ingestion service gracefully...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = ingestServer.Shutdown(shutdownCtx)
	_ = metricsServer.Shutdown(shutdownCtx)
	log.Println("👋 Ingestion service stopped.")
}

func getEnv(key, defaultVal string) string {
	val := os.Getenv(key)
	if val != "" {
		return val
	}
	return defaultVal
}
