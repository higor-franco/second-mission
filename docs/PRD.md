# Second Mission — Product Requirements Document

## Overview

Second Mission is a two-sided workforce platform that connects transitioning U.S. military veterans (E4–E6 NCOs with logistics/operational backgrounds) to civilian blue-collar roles in logistics, maintenance, construction, and field operations.

The platform solves two problems simultaneously: a structural blue-collar talent shortage (3.5M unfilled roles annually) and chronic veteran underemployment (73% in their first civilian year). It is framed as a market-relevant workforce solution — not a charity.

The core product is an AI-powered skills translation engine that maps military MOS (Military Occupational Specialty) codes to civilian task equivalents with match confidence scores, plus a two-sided marketplace connecting pre-qualified veterans to employers with open roles.

## Target Users

### Veterans (Supply Side)
- E4–E6 NCOs transitioning out of active duty
- Primarily from logistics, maintenance, engineering, and operational MOS backgrounds
- Located at or near Fort Cavazos (beachhead market), expanding to other bases
- Little to no awareness of civilian career options in industrial sectors
- Never pay for the platform

### Employers (Demand Side)
- VP of Operations / hiring managers at industrial companies with labor shortages
- Sectors: energy, oil & gas, construction, logistics, manufacturing, field operations
- Anchor employers: NOV (National Oilwell Varco), GE Renova
- Geography: Texas (beachhead), expanding nationally
- Pay subscription fees + per-hire placement fees

## Core Features

### Phase 1 — Veteran Experience (MVP)

**F1: Public Landing Page**
- Four-step veteran journey (Discover → Translate → Match → Place) with visual flow
- Salary benchmarks for matched industrial roles ($68K+ average)
- Role cards showing real career paths (wind turbine tech, logistics coordinator, maintenance lead, safety officer)
- Clear call-to-action to try the MOS translator or sign up

**F2: MOS Skills Translation Engine**
- Veteran enters their MOS code (e.g., 88M, 91B, 92Y, 12B, 68W)
- Engine returns matched civilian roles with:
  - Role title and description
  - Match confidence score (percentage)
  - Average salary range
  - Key transferable skills
  - Industry sector
- Seed data from O*NET Military Crosswalk (real SOC code mappings)
- Available without sign-up (the "wow" moment that drives registration)

**F2b: DD Form 214 Upload (AI Extraction)**
- Alternative entry path for veterans who'd rather not look up their MOS code(s) manually
- Veteran uploads their DD-214 PDF on the same `/translate` page (tabbed UI: "I know my MOS" vs "Upload my DD-214")
- Claude (Opus 4.7) reads the full form and extracts a structured profile: primary MOS, secondary MOS codes, ASI/SQI, rank, paygrade, years of service, military education, decorations, branch
- The platform aggregates civilian role matches across every MOS on the form, keeping the best match per role and unioning transferable skills
- Results show the extracted profile summary, the list of MOS codes recognized in the crosswalk, and the aggregated role matches (each tagged with the MOS that produced the strongest match)
- Privacy: the PDF is processed in memory and never persisted; only the extracted structured fields are kept for the duration of the response. A clear disclaimer is shown next to the upload control.
- Max 10 MB, PDF only (v1); unsupported MOS codes are surfaced to the user rather than silently dropped

**F3: Veteran Registration & Profile**
- Sign up with email (magic link auth — no passwords)
- Profile fields: name, MOS code, rank, years of service, separation date, location, preferred roles/industries
- Auto-populated skill matches from translation engine
- Profile visible to matched employers only

**F4: Veteran Dashboard**
- View matched employer opportunities with match scores
- Track application status (Matched → Introduced → Interviewing → Placed)
- Update profile and preferences

### Phase 2 — Employer Experience

**F5: Employer Landing Page**
- Value proposition: pre-qualified veteran talent pipeline
- WOTC tax credit callout ($2,400–$9,600 per hire)
- Pricing model overview (subscription + per-hire)
- Call-to-action for employer registration

**F6: Employer Registration & Dashboard**
- Company sign-up with separate employer auth flow
- Password recovery flow: forgot password → email with reset link → set new password
- Post open roles with task-level descriptions (not just job titles)
- Browse pre-matched veteran candidates with:
  - Match score
  - Availability date
  - Civilian-translated skill summary
  - WOTC eligibility flag
- Request introductions to candidates

**F7: WOTC Facilitation**
- Automatic WOTC eligibility flagging on veteran profiles
- Employer-facing documentation guidance for claiming credits

### Phase 3 — Platform Intelligence

**F8: Matching Algorithm**
- Task-level matching (not job-title matching)
- Bi-directional: veteran skills → employer needs AND employer roles → veteran matches
- Match confidence scoring based on skill overlap, location, availability

**F9: Pipeline Analytics**
- Placement tracking (Matched → Introduced → Interviewed → Hired)
- Cohort metrics for beachhead validation

## User Flows

### Veteran Flow
1. Lands on homepage → sees four-step journey and salary data
2. Enters MOS code → instantly sees matched civilian careers with scores
3. Impressed by results → signs up (magic link email)
4. Completes profile (rank, service years, separation date, location)
5. Receives matched employer opportunities on dashboard
6. Gets introduced to employers → interviews → placed

### Employer Flow
1. Lands on employer homepage → sees veteran talent pipeline value prop
2. Signs up as employer → creates company profile
3. Posts open roles with task-level descriptions
4. Browses pre-matched veteran candidates with scores
5. Requests introductions → interviews → hires
6. Claims WOTC credit with platform-provided guidance

## Non-Functional Requirements

- Mobile-responsive design (veterans often browse on phones)
- Sub-2-second MOS translation response time
- Accessible (WCAG 2.1 AA)
- Data privacy: veteran profiles visible only to matched employers
- Secure authentication via magic link (no passwords)

### Phase 4 — Admin & Observability

**F10: Admin Panel (Command Center)**
- Separate admin authentication (email + password, admin user type)
- Platform overview dashboard with key metrics (total veterans, employers, active listings, applications, placements)
- Full lists of all veterans, employers, job listings, and applications with search and filtering
- Activity logging system that tracks key user actions (logins, profile updates, job interest, listing creation, candidate status changes)
- Per-user activity log viewer showing activity across the last 10 sessions, with session summaries and detailed action timelines
- Admin endpoints are fully access-controlled — only admin sessions can access admin data; veteran and employer sessions are rejected

## Out of Scope (for now)

- Payment processing / billing system
- Real-time chat between veterans and employers
- Mobile native apps
- Integration with DoD/SkillBridge systems
- Automated interview scheduling
- Resume generation
