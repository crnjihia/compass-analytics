package mpesa

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// C2BCallbackPayload represents the payload sent by Safaricom Daraja C2B API
type C2BCallbackPayload struct {
	TransactionType   string `json:"TransactionType"`
	TransID           string `json:"TransID"`
	TransTime         string `json:"TransTime"` // YYYYMMDDHHmmss
	TransAmount       string `json:"TransAmount"`
	BusinessShortCode string `json:"BusinessShortCode"`
	BillRefNumber     string `json:"BillRefNumber"`
	InvoiceNumber     string `json:"InvoiceNumber"`
	OrgAccountBalance string `json:"OrgAccountBalance"`
	ThirdPartyTransID string `json:"ThirdPartyTransID"`
	MSISDN            string `json:"MSISDN"`
	FirstName         string `json:"FirstName"`
	MiddleName        string `json:"MiddleName"`
	LastName          string `json:"LastName"`
}

// C2BResponse is returned immediately to Safaricom Daraja API
type C2BResponse struct {
	ResultCode int    `json:"ResultCode"`
	ResultDesc string `json:"ResultDesc"`
}

var nonDigitRegex = regexp.MustCompile(`\D`)

// MaskMSISDN masks a Kenyan phone number for customer privacy (e.g., 254712345678 -> 2547****678)
func MaskMSISDN(msisdn string) string {
	digits := nonDigitRegex.ReplaceAllString(msisdn, "")
	if len(digits) < 8 {
		return "****"
	}
	prefix := digits[:4]
	suffix := digits[len(digits)-3:]
	return fmt.Sprintf("%s****%s", prefix, suffix)
}

// HashMSISDN hashes MSISDN using HMAC-SHA256 with tenant-scoped salt
func HashMSISDN(msisdn, salt string) string {
	cleaned := strings.TrimSpace(msisdn)
	mac := hmac.New(sha256.New, []byte(salt))
	mac.Write([]byte(cleaned))
	return hex.EncodeToString(mac.Sum(nil))
}

// ParseAmountToCents safely parses currency string (e.g. "1500.50" or "1500") to integer cents (int64)
func ParseAmountToCents(amountStr string) (int64, error) {
	clean := strings.TrimSpace(strings.ReplaceAll(amountStr, ",", ""))
	if clean == "" {
		return 0, nil
	}

	parts := strings.Split(clean, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid monetary amount format: %s", amountStr)
	}

	wholePart, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid whole amount: %s", parts[0])
	}

	var cents int64
	if len(parts) == 2 {
		fracStr := parts[1]
		if len(fracStr) == 1 {
			fracStr = fracStr + "0"
		} else if len(fracStr) > 2 {
			fracStr = fracStr[:2]
		}
		frac, err := strconv.ParseInt(fracStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid fractional amount: %s", fracStr)
		}
		cents = frac
	}

	if wholePart < 0 {
		return wholePart*100 - cents, nil
	}
	return wholePart*100 + cents, nil
}

// ParseTransTime parses Daraja timestamp format: "20240915123045"
func ParseTransTime(transTime string) (time.Time, error) {
	clean := strings.TrimSpace(transTime)
	if len(clean) == 14 {
		return time.Parse("20060102150405", clean)
	}
	// Fallback to RFC3339 if already formatted
	t, err := time.Parse(time.RFC3339, clean)
	if err == nil {
		return t, nil
	}
	return time.Now().UTC(), nil
}
