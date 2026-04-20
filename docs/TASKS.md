# Second Mission — Development Tasks

## Phase 1 — Veteran Experience (MVP)

| Task | Status | Notes |
|------|--------|-------|
| Project scaffolding (Go backend + React frontend + Postgres) | Done | Go stdlib + Vite + React + shadcn/ui + Tailwind |
| Database schema: MOS codes, civilian roles, skill mappings | Done | Seeded with real O*NET crosswalk data for 10 MOS codes, 30 civilian roles |
| MOS Translation API endpoint | Done | GET /api/translate?mos=88M + GET /api/mos-codes |
| Public landing page (hero, 4-step journey, salary benchmarks, role cards) | Done | Military-professional aesthetic, Bebas Neue + Source Sans 3 |
| MOS Translation UI (search + results with match scores) | Done | Circular score indicators, transferable skills, salary ranges |
| DD-214 upload + AI extraction (Claude Opus 4.7) | Done | POST /api/dd214/translate — multipart PDF in, structured profile + aggregated role matches out. Anthropic SDK; PDF sent natively so scanned forms work. In-memory only, never persisted. Tabbed UI on /translate: "I know my MOS" (existing) vs "Upload my DD-214" (new). Aggregates matches across all MOS codes on the form, keeping the best score per civilian role. 15 unit/integration tests (8 extractor parsing + 7 handler with fake extractor). |
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
| Employer landing page | Done | /employers — value prop, 4-step benefits, metrics bar, pricing overview, industry sectors, CTAs |
| Employer auth (separate login flow) | Done | POST /api/employer/register, POST /api/employer/login, password + bcrypt, session cookies, dev login endpoint |
| Employer registration & company profile | Done | /employer/register — full registration form with sector, location, description; /employer/profile — editable company profile |
| Employer dashboard (candidate browse, match scores, WOTC flags) | Done | /employer/dashboard — stats (active listings, total candidates, placements), listing management with toggle, candidate cards with match scores and status progression |
| Role posting (task-level descriptions) | Done | /employer/listings/new — create listings with civilian role category, task-level descriptions, requirements, benefits, salary, MOS preferences, WOTC flag |
| Introduction requests | Done | Employer can advance candidate status: interested → introduced → interviewing → placed via dashboard |
| Employer forgot/reset password | Done | POST /api/employer/forgot-password + POST /api/employer/reset-password, reuses magic_tokens table, SMTP email with 15-min expiry, frontend pages with full flow |

## Phase 3 — Platform Intelligence

| Task | Status | Notes |
|------|--------|-------|
| Hybrid AI matching engine | Done | 5-dimension scoring: MOS base (35%), skills overlap (25%), sector alignment (15%), MOS preference (15%), location match (10%). Computed on-the-fly with explainable breakdowns. Go matcher package with 11 unit tests |
| Pipeline tracking (Matched → Introduced → Interviewed → Hired) | Done (veteran side) | Employer side now done — bidirectional status management |
| Score breakdown UI on opportunities page | Done | AI MATCH badge, explanation text, expandable breakdown panel with visual bars for each dimension, matched skills highlighting |
| Score breakdown on applications page | Done | AI Match label on scores, explanation text on application cards |
| Cohort analytics | Pending | |

## Phase 4 — Admin & Observability

| Task | Status | Notes |
|------|--------|-------|
| Admin user system (auth, sessions) | Done | admins table, password+bcrypt auth, POST /api/admin/login, session cookies with user_type="admin", dev login endpoint |
| Admin dashboard (platform overview) | Done | /admin/dashboard — stat cards (veterans, employers, listings, applications, placements), recent veterans, recent activity, recent applications |
| Admin veterans management | Done | /admin/dashboard (Veterans tab) — full list with search by name/email/MOS/location, journey status badges |
| Admin employers management | Done | /admin/dashboard (Employers tab) — full list with search by company/email/sector, active status badges |
| Admin listings view | Done | /admin/dashboard (Listings tab) — all job listings with employer, sector, salary, WOTC, status |
| Admin applications view | Done | /admin/dashboard (Applications tab) — all applications with status filter, match scores, veteran/employer details |
| Activity logging system | Done | activity_logs table tracks all key user actions (login, register, update_profile, express_interest, create_listing, update_candidate_status) with session_id, IP, JSONB details |
| Admin activity log viewer | Done | /admin/dashboard (Activity Log tab) — view last 10 sessions per user, session summaries with action counts, full activity timeline with details, user picker sidebar |
| Admin backend tests | Done | 16 tests covering login, auth rejection, stats, list endpoints, activity logs, session queries, non-admin rejection |
