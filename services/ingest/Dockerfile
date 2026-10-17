# Multi-stage Dockerfile for Go M-Pesa Ingestion Service
FROM golang:1.23-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /build/ingest main.go

# Minimal runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -S compass && adduser -S compass -G compass

COPY --from=builder /build/ingest /usr/local/bin/ingest

USER compass

EXPOSE 8080 9100

ENTRYPOINT ["/usr/local/bin/ingest"]
