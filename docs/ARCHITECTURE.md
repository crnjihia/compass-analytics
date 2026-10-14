# Architecture

```mermaid
flowchart LR
    subgraph Frontend
        UI[UI (Next.js)] --> API[tRPC API]
    end
    subgraph Backend
        API --> DB[(PostgreSQL)]
        API --> Redis[Redis Cache]
        Worker[Worker (Node/Go)] --> DB
    end
    subgraph Infra
        DB -->|RLS| Tenant[Tenants]
        Redis -->|Cache| API
    end
```

The diagram shows the high‑level components: a Next.js front‑end using tRPC to call the API, which talks to PostgreSQL (with row‑level security for multi‑tenant isolation) and Redis for caching. A background worker ingests M‑Pesa events, updates the DB, and invalidates the cache.
