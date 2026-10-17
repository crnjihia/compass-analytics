package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"compass-analytics/ingest/internal/mpesa"
)

var (
	ingestURL = flag.String("url", "http://localhost:8080", "Ingest service base URL")
	count     = flag.Int("count", 10, "Total number of transactions to simulate")
	interval  = flag.Duration("interval", 300*time.Millisecond, "Delay between transactions")
	orgFlag   = flag.String("org", "all", "Target organization: org_baraka_hardware, org_nairobi_fresh, or all")
)

var tenants = []struct {
	OrgID     string
	ShortCode string
	Type      string
}{
	{
		OrgID:     "org_baraka_hardware",
		ShortCode: "890123",
		Type:      "Customer PayBill",
	},
	{
		OrgID:     "org_nairobi_fresh",
		ShortCode: "987654",
		Type:      "Customer Buy Goods",
	},
}

var firstNames = []string{"Juma", "Amina", "David", "Faith", "Brian", "Grace", "Hassan", "Mercy", "Kevin", "Mary"}
var middleNames = []string{"Kamau", "Wanjiku", "Omondi", "Muthoni", "Kiprono", "Achieng", "Ali", "Njeri", "Otieno", "Wambui"}
var lastNames = []string{"Mwangi", "Kariuki", "Ochieng", "Njoroge", "Chebet", "Koech", "Maina", "Kimani", "Cheruiyot", "Barasa"}

var amounts = []string{
	"150.00", "280.00", "450.00", "920.00", "1200.00", "1850.50", "2450.00", "5100.00", "8500.00", "12500.00",
}

func main() {
	flag.Parse()

	log.Printf("🚀 Starting M-Pesa Daraja C2B Traffic Simulator (Target: %s, Count: %d)\n", *ingestURL, *count)

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	client := &http.Client{Timeout: 5 * time.Second}

	successCount := 0

	for i := 1; i <= *count; i++ {
		// Pick tenant
		var targetTenant = tenants[r.Intn(len(tenants))]
		if *orgFlag == "org_baraka_hardware" {
			targetTenant = tenants[0]
		} else if *orgFlag == "org_nairobi_fresh" {
			targetTenant = tenants[1]
		}

		// Generate random transaction
		transID := fmt.Sprintf("SIM%04X%04X", r.Intn(0xFFFF), r.Intn(0xFFFF))
		msisdn := fmt.Sprintf("2547%08d", r.Intn(99999999))
		firstName := firstNames[r.Intn(len(firstNames))]
		middleName := middleNames[r.Intn(len(middleNames))]
		lastName := lastNames[r.Intn(len(lastNames))]
		amount := amounts[r.Intn(len(amounts))]
		billRef := fmt.Sprintf("INV-%04d", r.Intn(9999))

		payload := mpesa.C2BCallbackPayload{
			TransactionType:   targetTenant.Type,
			TransID:           transID,
			TransTime:         time.Now().Format("20060102150405"),
			TransAmount:       amount,
			BusinessShortCode: targetTenant.ShortCode,
			BillRefNumber:     billRef,
			MSISDN:            msisdn,
			FirstName:         firstName,
			MiddleName:        middleName,
			LastName:          lastName,
		}

		data, _ := json.Marshal(payload)
		endpoint := fmt.Sprintf("%s/mpesa/c2b/confirmation/%s", *ingestURL, targetTenant.OrgID)

		resp, err := client.Post(endpoint, "application/json", bytes.NewBuffer(data))
		if err != nil {
			log.Printf("❌ [%d/%d] Request failed: %v\n", i, *count, err)
		} else {
			var c2bResp mpesa.C2BResponse
			_ = json.NewDecoder(resp.Body).Decode(&c2bResp)
			resp.Body.Close()

			if resp.StatusCode == http.StatusOK && c2bResp.ResultCode == 0 {
				log.Printf("✅ [%d/%d] [%s] %s | %s KES | %s %s (%s)\n",
					i, *count, targetTenant.OrgID, transID, amount, firstName, lastName, billRef)
				successCount++
			} else {
				log.Printf("⚠️ [%d/%d] Ingest returned status %d: %s\n", i, *count, resp.StatusCode, c2bResp.ResultDesc)
			}
		}

		if i < *count && *interval > 0 {
			time.Sleep(*interval)
		}
	}

	log.Printf("🏁 Simulation finished: %d/%d transactions successfully accepted.\n", successCount, *count)
}
