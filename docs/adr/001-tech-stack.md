# 001 - Tech Stack: Go + React + Postgres

**Status:** Accepted

## Context
Second Mission needs a full-stack web platform that is fast, deployable as a single container, and can serve both a JSON API and a React SPA from one binary.

## Decision
- **Backend:** Go stdlib `net/http` router with `pgx/v5` for Postgres and `sqlc` for type-safe query generation
- **Frontend:** Vite + React + TypeScript with shadcn/ui components and Tailwind CSS
- **Database:** PostgreSQL via `supabase/postgres:17.6.1.103` (matching production image)
- **Deployment:** Single Docker container — Go binary serves API + embedded frontend assets

## Rationale
Go provides a simple, fast, single-binary deployment model. sqlc generates type-safe database code from SQL, avoiding ORM complexity. React + shadcn/ui provides a modern component library with full design control via Tailwind. The single-binary approach means one container to deploy and monitor.

## Trade-offs
**Pros:**
- Fast builds, small container images
- Type-safe SQL queries (compile-time errors, not runtime)
- Single container simplifies deployment
- No ORM abstraction leaks

**Cons:**
- More verbose than framework-heavy alternatives (Rails, Django)
- sqlc requires writing raw SQL (but this is also a pro — explicit queries)

## Alternatives Considered
- **Node.js/Express:** Considered per CLAUDE.md, but Go's single-binary model is better for deployment simplicity
- **Python/Django:** Heavier framework, slower cold starts, more complex containerization
