package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"compass-analytics/ingest/internal/mpesa"
	"compass-analytics/ingest/internal/queue"

	"github.com/go-chi/chi/v5"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

const (
	testRedisURL = "redis://172.26.192.86:6379"
	testDBURL    = "postgresql://compass_app:compass_secret@172.26.192.86:5433/compass_analytics?sslmode=disable"
	testOrgID    = "org_baraka_hardware"
)

func setupTestRouter(rdb *redis.Client) http.Handler {
	r := chi.NewRouter()

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok","service":"compass-ingest"}`)
	})

	r.Post("/mpesa/c2b/validation/{org_id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mpesa.C2BResponse{ResultCode: 0, ResultDesc: "Accepted"})
	})

	r.Post("/mpesa/c2b/confirmation/{org_id}", func(w http.ResponseWriter, r *http.Request) {
		orgID := chi.URLParam(r, "org_id")

		var payload mpesa.C2BCallbackPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(mpesa.C2BResponse{ResultCode: 1, ResultDesc: "Rejected"})
			return
		}

		_, err := queue.Enqueue(r.Context(), rdb, orgID, &payload)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(mpesa.C2BResponse{ResultCode: 1, ResultDesc: "Error"})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mpesa.C2BResponse{ResultCode: 0, ResultDesc: "Accepted"})
	})

	return r
}

func TestHealthCheck(t *testing.T) {
	r := setupTestRouter(nil)
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}
}

func TestValidationEndpoint(t *testing.T) {
	r := setupTestRouter(nil)
	req := httptest.NewRequest("POST", "/mpesa/c2b/validation/"+testOrgID, nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}

	var resp mpesa.C2BResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if resp.ResultCode != 0 || resp.ResultDesc != "Accepted" {
		t.Errorf("Unexpected response: %+v", resp)
	}
}

func TestConfirmationAndWorkerProcessing(t *testing.T) {
	opt, err := redis.ParseURL(testRedisURL)
	if err != nil {
		t.Skipf("Skipping integration test: invalid redis URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("Skipping integration test: redis not reachable: %v", err)
	}

	db, err := sql.Open("postgres", testDBURL)
	if err != nil {
		t.Skipf("Skipping integration test: db not reachable: %v", err)
	}
	defer db.Close()

	// Initialize worker
	worker := queue.NewWorker(rdb, db, "test-worker-01")
	if err := worker.InitConsumerGroup(ctx); err != nil {
		t.Logf("Consumer group warning: %v", err)
	}

	// Start worker in background
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()
	go worker.Start(workerCtx)

	router := setupTestRouter(rdb)

	// Create unique transaction
	uniqueTransID := fmt.Sprintf("TST%08d", time.Now().UnixNano()%100000000)
	payload := mpesa.C2BCallbackPayload{
		TransactionType:   "Customer PayBill",
		TransID:           uniqueTransID,
		TransTime:         time.Now().Format("20060102150405"),
		TransAmount:       "1500.50",
		BusinessShortCode: "890123",
		BillRefNumber:     "INV-TEST-001",
		MSISDN:            "254712345678",
		FirstName:         "Alice",
		LastName:          "Wanjiku",
	}

	bodyBytes, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/mpesa/c2b/confirmation/"+testOrgID, bytes.NewBuffer(bodyBytes))
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp mpesa.C2BResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if resp.ResultCode != 0 {
		t.Errorf("Expected ResultCode 0, got %d", resp.ResultCode)
	}

	// Wait up to 3 seconds for background worker to consume and persist to DB
	var dbFound bool
	for attempt := 0; attempt < 15; attempt++ {
		time.Sleep(200 * time.Millisecond)

		// Check database with RLS setting
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			continue
		}
		_, _ = tx.ExecContext(ctx, "SELECT set_config('app.org_id', $1, true)", testOrgID)

		var count int
		err = tx.QueryRowContext(ctx, `
			SELECT count(*) FROM transactions WHERE org_id = $1 AND mpesa_receipt = $2
		`, testOrgID, uniqueTransID).Scan(&count)
		_ = tx.Rollback()

		if err == nil && count > 0 {
			dbFound = true
			break
		}
	}

	if !dbFound {
		t.Errorf("Worker did not persist transaction %s to PostgreSQL within timeout", uniqueTransID)
	}

	// Clean up test transaction from DB
	cleanTx, err := db.BeginTx(ctx, nil)
	if err == nil {
		_, _ = cleanTx.ExecContext(ctx, "SELECT set_config('app.org_id', $1, true)", testOrgID)
		_, _ = cleanTx.ExecContext(ctx, "DELETE FROM transactions WHERE org_id = $1 AND mpesa_receipt = $2", testOrgID, uniqueTransID)
		_ = cleanTx.Commit()
	}
}
