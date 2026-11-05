# 0007 – SSE Fallback Strategy

## Context

Compass Analytics provides a real‑time revenue stream to the dashboard via Server‑Sent Events (SSE). In production environments, network intermediaries, browser extensions, or temporary connectivity loss can cause SSE connections to fail or stall. To guarantee a seamless user experience, the client library implements a **fallback polling strategy** after a configurable number of consecutive SSE errors.

## Decision

- **Primary delivery**: SSE (`/api/stream/revenue`) is used whenever the client can successfully open an `EventSource`.
- **Error threshold**: After `maxConsecutiveErrorsBeforeFallback` (default `3`) consecutive `onerror` callbacks, the hook automatically switches to HTTP polling (`pollIntervalMs`, default `5 000 ms`).
- **Self‑healing**: While polling, a retry timer (`30 s`) attempts to re‑establish the SSE connection. If successful, the hook reverts to SSE mode and clears the polling interval.
- **Visibility**: The hook surface exposes `status` (`connected`, `reconnecting`, `polling`, `disconnected`) and `isPolling` flags, allowing UI components to render appropriate status badges.

## Rationale

- **Reliability** – Guarantees data updates even when SSE is unavailable.
- **Performance** – Polling interval is modest (5 s) to avoid excessive load while still providing timely updates.
- **User Experience** – UI can clearly indicate whether the live stream is active or in fallback mode.

## Alternatives Considered

1. **Long‑polling** – Rejected due to higher latency and server load.
2. **WebSocket** – Would require additional infrastructure and protocol negotiation; SSE already satisfies one‑way broadcast needs.

## Implementation Notes

- The hook logs a warning when entering fallback mode.
- Consumers can manually invoke `reconnect` to force a new SSE attempt.
- Tests (`useLiveRevenue.test.ts`) verify the transition logic and callback invocation.

## Impact

- No breaking changes to existing API contracts.
- Consumers receive a new `status` value (`polling`).
- Added documentation in `docs/DEVELOPMENT.md` and an ADR entry.
