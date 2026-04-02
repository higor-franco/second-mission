# 004 - Veteran Pipeline Tracking: Job Listings + Application Status

**Status:** Accepted

## Context

The veteran dashboard showed career role matches (MOS → civilian role types), but veterans had no way to see real employer job postings, express interest, or track their placement progress. The four-step journey (Discover → Translate → Match → Place) needed to become functional end-to-end, not just informational.

## Decision

Added two new tables (`job_listings`, `veteran_applications`), seeded with 25+ real job listings from 10 Texas anchor employers, and introduced pipeline status tracking with 5 states: matched → interested → introduced → interviewing → placed.

Added a `journey_step` column to the `veterans` table that auto-advances based on activity (setting MOS advances to `translate`, loading opportunities advances to `match`, expressing interest advances to `place`).

Built two new frontend pages:
- **Opportunities** (`/opportunities`): matched jobs from real Texas employers, with sector filters, match scores, WOTC badge, expandable details, and Express Interest button
- **Applications** (`/applications`): visual pipeline funnel (count by status), filtered application list with progress dots

Upgraded the Dashboard to show the journey tracker (4-step visual with current step highlighted), stats row (career matches, avg score, active apps, placements), and quick-access panels to both new pages.

## Rationale

Veterans need to see real, specific job postings (not just career categories) to understand what the platform actually delivers. The pipeline tracking makes the placement process transparent and actionable. Auto-advancing the journey step keeps the product narrative coherent without requiring manual state management.

## Trade-offs

**Pros:**
- End-to-end veteran journey is now fully functional
- 25+ real seeded job listings from credible Texas employers give the platform immediate demo value
- Journey step tracking creates a clear product story for the Wharton presentation
- Application pipeline tracks the placement funnel that is Second Mission's core value proposition

**Cons:**
- Applications status (`introduced`, `interviewing`, `placed`) can only be updated by PUT endpoint — no employer-side status updates yet (Phase 2)
- Job listings are seeded data, not live postings — live posting management is Phase 2

## Alternatives Considered

- **Show only career role types (status quo):** Too abstract. Veterans need to see real companies and real jobs to understand the value proposition.
- **External ATS integration:** Too complex for MVP. Seeded data validates the matching logic and delivers demo value immediately.
