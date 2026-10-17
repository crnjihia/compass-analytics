package mpesa

import (
	"testing"
	"time"
)

func TestMaskMSISDN(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"254712345678", "2547****678"},
		{"+254722987654", "2547****654"},
		{"0712345678", "0712****678"},
		{"123", "****"},
	}

	for _, tt := range tests {
		got := MaskMSISDN(tt.input)
		if got != tt.expected {
			t.Errorf("MaskMSISDN(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestParseAmountToCents(t *testing.T) {
	tests := []struct {
		input    string
		expected int64
	}{
		{"1500.00", 150000},
		{"1500.50", 150050},
		{"1500.5", 150050},
		{"1500", 150000},
		{"1,500.25", 150025},
		{"0.00", 0},
		{"", 0},
	}

	for _, tt := range tests {
		got, err := ParseAmountToCents(tt.input)
		if err != nil {
			t.Fatalf("ParseAmountToCents(%q) unexpected error: %v", tt.input, err)
		}
		if got != tt.expected {
			t.Errorf("ParseAmountToCents(%q) = %d; want %d", tt.input, got, tt.expected)
		}
	}
}

func TestHashMSISDN(t *testing.T) {
	salt := "test_salt_secret"
	hash1 := HashMSISDN("254712345678", salt)
	hash2 := HashMSISDN("254712345678", salt)
	hashDiff := HashMSISDN("254799999999", salt)

	if hash1 == "" {
		t.Errorf("Expected non-empty hash")
	}
	if hash1 != hash2 {
		t.Errorf("Expected deterministic hash for same MSISDN and salt")
	}
	if hash1 == hashDiff {
		t.Errorf("Expected different hashes for different MSISDNs")
	}
}

func TestParseTransTime(t *testing.T) {
	raw := "20240915123045"
	parsed, err := ParseTransTime(raw)
	if err != nil {
		t.Fatalf("Unexpected error parsing trans time: %v", err)
	}

	expectedYear := 2024
	expectedMonth := time.September
	expectedDay := 15

	if parsed.Year() != expectedYear || parsed.Month() != expectedMonth || parsed.Day() != expectedDay {
		t.Errorf("Parsed time = %v; want year %d month %v day %d", parsed, expectedYear, expectedMonth, expectedDay)
	}
}
