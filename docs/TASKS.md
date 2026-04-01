# Second Mission — Development Tasks

## Phase 1 — Veteran Experience (MVP)

| Task | Status | Notes |
|------|--------|-------|
| Project scaffolding (Go backend + React frontend + Postgres) | Done | Go stdlib + Vite + React + shadcn/ui + Tailwind |
| Database schema: MOS codes, civilian roles, skill mappings | Done | Seeded with real O*NET crosswalk data for 10 MOS codes, 30 civilian roles |
| MOS Translation API endpoint | Done | GET /api/translate?mos=88M + GET /api/mos-codes |
| Public landing page (hero, 4-step journey, salary benchmarks, role cards) | Done | Military-professional aesthetic, Bebas Neue + Source Sans 3 |
| MOS Translation UI (search + results with match scores) | Done | Circular score indicators, transferable skills, salary ranges |
| Veteran auth (magic link email) | Pending | Separate login flow from employers |
| Veteran registration & profile | Pending | |
| Veteran dashboard (matched opportunities, status tracking) | Pending | |

## Phase 2 — Employer Experience

| Task | Status | Notes |
|------|--------|-------|
| Employer landing page | Pending | |
| Employer auth (separate login flow) | Pending | |
| Employer registration & company profile | Pending | |
| Employer dashboard (candidate browse, match scores, WOTC flags) | Pending | |
| Role posting (task-level descriptions) | Pending | |
| Introduction requests | Pending | |

## Phase 3 — Platform Intelligence

| Task | Status | Notes |
|------|--------|-------|
| Task-level matching algorithm | Pending | |
| Pipeline tracking (Matched → Introduced → Interviewed → Hired) | Pending | |
| Cohort analytics | Pending | |
