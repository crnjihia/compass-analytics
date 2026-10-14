---
number: 0001
title: Choose tRPC for end‑to‑end type safety
status: accepted
---

## Context

We need a way for the front‑end (Next.js) to call back‑end services while preserving TypeScript types across the wire. The options considered were:

- REST with OpenAPI generation
- GraphQL with code‑gen
- tRPC (type‑safe RPC)

## Decision

We chose **tRPC** because:

- It gives full type safety without a separate schema language.
- Minimal boilerplate compared to GraphQL.
- Works well with Next.js App Router.
- Community support for React Query integration.

## Consequences

- All API routes will be defined in `src/server/router` and exported as a tRPC router.
- Front‑end will use `@trpc/react-query` for data fetching.
- Future changes to the API surface will require updating the shared TypeScript types, which is enforced by CI.
