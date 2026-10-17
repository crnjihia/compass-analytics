package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"compass-analytics/ingest/internal/metrics"
	"compass-analytics/ingest/internal/mpesa"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	StreamName    = "mpesa:txns"
	ConsumerGroup = "mpesa_workers"
)

type Worker struct {
	rdb          *redis.Client
	db           *sql.DB
	consumerName string
	stopChan     chan struct{}
}

func NewWorker(rdb *redis.Client, db *sql.DB, consumerName string) *Worker {
	return &Worker{
		rdb:          rdb,
		db:           db,
		consumerName: consumerName,
		stopChan:     make(chan struct{}),
	}
}

// InitConsumerGroup initializes the Redis Streams consumer group if it does not already exist
func (w *Worker) InitConsumerGroup(ctx context.Context) error {
	err := w.rdb.XGroupCreateMkStream(ctx, StreamName, ConsumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("failed to create consumer group: %w", err)
	}
	return nil
}

// Enqueue adds an incoming M-Pesa C2B callback to the Redis Stream
func Enqueue(ctx context.Context, rdb *redis.Client, orgID string, payload *mpesa.C2BCallbackPayload) (string, error) {
	dataBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	msgID, err := rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamName,
		Values: map[string]interface{}{
			"org_id":   orgID,
			"payload":  string(dataBytes),
			"trans_id": payload.TransID,
		},
	}).Result()
	if err != nil {
		return "", fmt.Errorf("failed to enqueue to redis stream: %w", err)
	}

	// Update queue depth gauge
	if depth, err := rdb.XLen(ctx, StreamName).Result(); err == nil {
		metrics.QueueDepth.Set(float64(depth))
	}

	return msgID, nil
}

// Start launches the background worker loop
func (w *Worker) Start(ctx context.Context) {
	log.Printf("👷 Starting M-Pesa consumer worker: %s (Group: %s, Stream: %s)\n", w.consumerName, ConsumerGroup, StreamName)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-w.stopChan:
				return
			case <-ticker.C:
				if depth, err := w.rdb.XLen(ctx, StreamName).Result(); err == nil {
					metrics.QueueDepth.Set(float64(depth))
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Worker context cancelled, stopping worker loop.")
			return
		case <-w.stopChan:
			log.Println("🛑 Worker stop signal received, exiting.")
			return
		default:
			// Read messages from consumer group
			streams, err := w.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    ConsumerGroup,
				Consumer: w.consumerName,
				Streams:  []string{StreamName, ">"},
				Count:    10,
				Block:    2 * time.Second,
			}).Result()

			if err != nil {
				if err != redis.Nil && !strings.Contains(err.Error(), "context canceled") {
					log.Printf("⚠️ Error reading from stream: %v\n", err)
					time.Sleep(1 * time.Second)
				}
				continue
			}

			for _, stream := range streams {
				for _, message := range stream.Messages {
					if err := w.processMessage(ctx, message); err != nil {
						log.Printf("❌ Error processing message %s: %v\n", message.ID, err)
					} else {
						// Acknowledge processed message
						w.rdb.XAck(ctx, StreamName, ConsumerGroup, message.ID)
					}
				}
			}
		}
	}
}

// Stop gracefully stops the consumer worker
func (w *Worker) Stop() {
	close(w.stopChan)
}

func (w *Worker) processMessage(ctx context.Context, msg redis.XMessage) error {
	orgID, ok := msg.Values["org_id"].(string)
	if !ok || orgID == "" {
		return fmt.Errorf("missing org_id in stream message")
	}

	payloadRaw, ok := msg.Values["payload"].(string)
	if !ok || payloadRaw == "" {
		return fmt.Errorf("missing payload in stream message")
	}

	var payload mpesa.C2BCallbackPayload
	if err := json.Unmarshal([]byte(payloadRaw), &payload); err != nil {
		return fmt.Errorf("invalid json payload: %w", err)
	}

	// 1. Deduplication Check via Redis SETNX (24h TTL)
	dedupKey := fmt.Sprintf("dedup:mpesa:%s:%s", orgID, payload.TransID)
	set, err := w.rdb.SetNX(ctx, dedupKey, "1", 24*time.Hour).Result()
	if err != nil {
		log.Printf("⚠️ Redis dedup check failed: %v (continuing with DB ON CONFLICT)\n", err)
	} else if !set {
		log.Printf("ℹ️ Duplicate transaction ignored: %s (%s)\n", payload.TransID, orgID)
		metrics.TransactionsProcessedTotal.WithLabelValues(orgID, "duplicate").Inc()
		return nil
	}

	// 2. Parse and normalize data
	amountCents, err := mpesa.ParseAmountToCents(payload.TransAmount)
	if err != nil {
		return fmt.Errorf("failed to parse amount %s: %w", payload.TransAmount, err)
	}

	paidAt, err := mpesa.ParseTransTime(payload.TransTime)
	if err != nil {
		paidAt = time.Now().UTC()
	}

	maskedMsisdn := mpesa.MaskMSISDN(payload.MSISDN)
	msisdnHash := mpesa.HashMSISDN(payload.MSISDN, orgID)

	customerName := strings.TrimSpace(fmt.Sprintf("%s %s %s", payload.FirstName, payload.MiddleName, payload.LastName))
	if customerName == "" {
		customerName = "M-Pesa Customer"
	}

	// 3. PostgreSQL Transaction Enforcing Row-Level Security
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start db transaction: %w", err)
	}
	defer tx.Rollback()

	// CRITICAL: Set RLS tenant context inside the transaction
	_, err = tx.ExecContext(ctx, "SELECT set_config('app.org_id', $1, true)", orgID)
	if err != nil {
		return fmt.Errorf("failed to set postgres RLS session tenant: %w", err)
	}

	// Insert into transactions table
	txnID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO transactions (id, org_id, mpesa_receipt, msisdn_hash, masked_msisdn, customer_name, amount_cents, bill_ref, paid_at, raw, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (org_id, mpesa_receipt) DO NOTHING
	`, txnID, orgID, payload.TransID, msisdnHash, maskedMsisdn, customerName, amountCents, payload.BillRefNumber, paidAt, payloadRaw)
	if err != nil {
		return fmt.Errorf("failed to insert transaction: %w", err)
	}

	// Upsert Customer (first_seen, last_seen, txn_count, ltv_cents)
	custID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO customers (id, org_id, msisdn_hash, masked_msisdn, customer_name, first_seen_at, last_seen_at, txn_count, ltv_cents, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6, 1, $7, NOW())
		ON CONFLICT (org_id, msisdn_hash) DO UPDATE SET
			last_seen_at = EXCLUDED.last_seen_at,
			txn_count = customers.txn_count + 1,
			ltv_cents = customers.ltv_cents + EXCLUDED.ltv_cents,
			customer_name = COALESCE(EXCLUDED.customer_name, customers.customer_name)
	`, custID, orgID, msisdnHash, maskedMsisdn, customerName, paidAt, amountCents)
	if err != nil {
		return fmt.Errorf("failed to upsert customer: %w", err)
	}

	// Upsert Hourly Rollup
	hourBucket := time.Date(paidAt.Year(), paidAt.Month(), paidAt.Day(), paidAt.Hour(), 0, 0, 0, time.UTC)
	rollupID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO revenue_hourly (id, org_id, bucket, total_cents, txn_count)
		VALUES ($1, $2, $3, $4, 1)
		ON CONFLICT (org_id, bucket) DO UPDATE SET
			total_cents = revenue_hourly.total_cents + EXCLUDED.total_cents,
			txn_count = revenue_hourly.txn_count + 1
	`, rollupID, orgID, hourBucket, amountCents)
	if err != nil {
		return fmt.Errorf("failed to upsert hourly revenue rollup: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit db transaction: %w", err)
	}

	// 4. Redis Pub/Sub for Real-Time SSE Dashboard Updates
	pubPayload := map[string]interface{}{
		"id":           txnID,
		"orgId":        orgID,
		"mpesaReceipt": payload.TransID,
		"customerName": customerName,
		"maskedMsisdn": maskedMsisdn,
		"amountCents":  amountCents,
		"paidAt":       paidAt.Format(time.RFC3339),
		"billRef":      payload.BillRefNumber,
	}
	pubBytes, _ := json.Marshal(pubPayload)
	pubChannel := fmt.Sprintf("org:%s:txn", orgID)
	w.rdb.Publish(ctx, pubChannel, string(pubBytes))

	metrics.TransactionsProcessedTotal.WithLabelValues(orgID, "success").Inc()
	log.Printf("✅ Processed M-Pesa txn %s for %s: %s KES (cents: %d)\n", payload.TransID, orgID, payload.TransAmount, amountCents)
	return nil
}
