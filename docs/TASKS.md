# Second Mission — Development Tasks

## Phase 1 — Veteran Experience (MVP)

| Task | Status | Notes |
|------|--------|-------|
| Project scaffolding (Go backend + React frontend + Postgres) | Done | Go stdlib + Vite + React + shadcn/ui + Tailwind |
| Database schema: MOS codes, civilian roles, skill mappings | Done | Seeded with real O*NET crosswalk data for 10 MOS codes, 30 civilian roles |
| MOS Translation API endpoint | Done | GET /api/translate?mos=88M + GET /api/mos-codes |
| Public landing page (hero, 4-step journey, salary benchmarks, role cards) | Done | Military-professional aesthetic, Bebas Neue + Source Sans 3 |
| MOS Translation UI (search + results with match scores) | Done | Circular score indicators, transferable skills, salary ranges |
| Veteran auth (magic link email) | Done | POST /auth/magic-link, GET /auth/verify, dev login endpoint, session cookies |
| Veteran registration & profile | Done | Auto-created on first login, PUT /api/veteran/profile, profile editing page |
| Veteran dashboard with journey tracker | Done | 4-step journey progress, stats row, links to opportunities and pipeline |
| Employer job listings — database + seed data | Done | 25+ listings from 10 Texas employers (NOV, GE Vernova, KBR, Fluor, XTO, etc.) |
| Veteran opportunities page (matched job listings) | Done | GET /api/veteran/opportunities, sector filters, WOTC badge, Express Interest |
| Application / pipeline tracking | Done | POST /api/veteran/applications, GET /api/veteran/applications, status pipeline |
| Journey step tracking | Done | Auto-advances through discover→translate→match→place based on activity, real-time UI updates via auth context |

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
| Pipeline tracking (Matched → Introduced → Interviewed → Hired) | Done (veteran side) | Admin/employer side pending |
| Cohort analytics | Pending | |
