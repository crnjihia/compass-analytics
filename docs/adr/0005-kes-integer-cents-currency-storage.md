---
number: 0005
title: Storing Money as 64-bit Integer KES Cents (BigInt)
status: accepted
date: 2026-10-17
---

## Context

Financial data representation in multi-tenant business analytics requires strict precision. Representing Kenyan Shilling amounts with floating-point formats (`FLOAT4`, `FLOAT8`, JavaScript `number`) introduces IEEE 754 precision rounding errors (e.g. `0.1 + 0.2 === 0.30000000000000004`). In financial ledgers, rounding drifts corrupt aggregate revenue reports, reconciliation with bank statements, and tax audit reporting.

Options considered:
1. **IEEE 754 Floating Point (`Float` / `Double`)**: Fast native hardware support, but susceptible to catastrophic rounding errors.
2. **PostgreSQL `DECIMAL(14, 2)` / `NUMERIC`**: Arbitrary-precision database type, but requires string parsing in JSON APIs or decimal libraries in JavaScript.
3. **64-bit Integer Minor Units (`BigInt` / Cents)**: Storing money as integer cents (1 KES = 100 cents).

## Decision

We chose **64-bit integer cents (`BigInt`)** stored as `BIGINT` in PostgreSQL and typed as `bigint` in TypeScript and `int64` in Go.

Formatting & Conversion Rules:
- All database columns (`amountCents`, `priceCents`, `costPriceCents`, `totalRevenueCents`) store integer cents.
- Parsing from strings or float inputs (`"1500.50"` -> `150050n`) is handled deterministically via `parseAmountToCents`.
- Formatting for display (`formatKes(150050n)` -> `"KES 1,500.50"`) is applied at the presentation boundary in the UI.
- SuperJSON serializer handles `BigInt` wire transfer between Next.js tRPC server and React Query clients without JSON stringification truncation.

## Consequences

### Positive:
- **Zero Rounding Inaccuracies**: Total revenue summations, tax computations, and customer averages produce exact integer results.
- **Fast Arithmetic**: Native 64-bit CPU integer instructions execute significantly faster than arbitrary-precision decimal software libraries.
- **Cross-Language Consistency**: TypeScript `bigint`, Go `int64`, and PostgreSQL `BIGINT` map 1:1 without semantic mismatch.

### Negative / Trade-offs:
- Standard `JSON.stringify` throws a `TypeError: Do not know how to serialize a BigInt`. This requires SuperJSON transformer integration in tRPC routers and custom Redis serialization handlers.
