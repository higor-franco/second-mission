# 008 - Employer Hiring Funnel (5-stage)

**Status:** Accepted

## Context

The employer dashboard originally surfaced a 4-stage pipeline —
`interested → introduced → interviewing → placed` — plus a pre-application
`matched` system state. For the product to be useful to an actual hiring
manager, two more real-world stages were missing between `interviewing`
and `placed`:

- An offer being extended to the candidate (but not yet signed).
- A contract being signed (but the candidate hasn't started yet).

Hiring managers routinely need to track candidates in those gaps — an
offer that sat a week vs. a contract that hasn't started yet are very
different operational states, and "interviewing" (a vague bucket) doesn't
capture either.

The user also asked for a per-listing funnel view so they can see, for a
given role, where every candidate is across all stages at once (the
current dashboard's candidate list is cross-listing and harder to scan).

## Decision

Extend the DB status enum with two new statuses — `proposal_sent` and
`contract_signed` — while keeping the existing statuses intact. Group
the resulting 7 statuses into 5 UX buckets on a new per-listing Kanban
funnel:

| Column    | Backend statuses              | Meaning                          |
| --------- | ----------------------------- | -------------------------------- |
| Match     | `matched`, `interested`       | Matched + expressed interest     |
| Interview | `introduced`, `interviewing`  | Introduced + actively interviewing |
| Proposal  | `proposal_sent`               | Offer extended                   |
| Contract  | `contract_signed`             | Contract signed, awaiting start  |
| End       | `placed`                      | Hired                            |

Forward progression in the employer UI (one status at a time):

```
interested → introduced → interviewing → proposal_sent → contract_signed → placed
```

The funnel lives on a new page at `/employer/listings/:id`, backed by a
new endpoint `GET /api/employer/listings/:id/candidates` that returns
both the listing and the candidates in a single round-trip.

## Rationale

**Why extend the enum rather than rewrite it.** The veteran-side UX
already shows veterans their own status in the existing terms
(`interested`, `introduced`, etc.). Renaming those states would break
every existing application and the on-screen language veterans have
been seeing. Extending the enum keeps the veteran experience stable
while giving the employer the fuller funnel they asked for.

**Why 5 UX buckets instead of exposing all 7 states directly.** The
backend keeps `matched` vs. `interested` distinct because veterans see
a different message for each (the system proactively matched vs. they
actively clicked); similarly `introduced` vs. `interviewing` are
different veteran-facing milestones. But for the hiring manager, those
fine-grained distinctions add noise — they care about *bucket*
(Match / Interview / Proposal / Contract / End). Grouping at the UI
layer gives both sides the view that fits their workflow.

**Why a dedicated endpoint instead of filtering the existing one.**
`ListCandidatesForEmployer` returns cross-listing data for the
dashboard's flat candidate list. The detail page needs listing metadata
AND candidates scoped to one listing — two separate shapes and filters.
A dedicated endpoint avoids bloating the existing response or pushing
scoping logic into the frontend.

## Trade-offs

**Pros:**

- Hiring managers can track the two post-interview stages that matter
  operationally (offer out, contract signed).
- Veterans keep seeing the same status vocabulary they had before — no
  disruption to the logged-in veteran UI.
- Per-listing funnel makes it trivial to understand "where are my
  Fleet Ops candidates?" without filtering a cross-listing table.
- Cross-employer isolation is enforced at the query level
  (`jl.employer_id = $2` in the WHERE clause), so the detail endpoint
  returns 404 when an employer requests another company's listing.

**Cons:**

- The DB status enum is now wider (7 values). Any future feature that
  branches on status needs to handle the two new values.
- Two handler whitelists (employer + veteran) must stay in sync with
  the DB CHECK constraint. Tests drive the full chain to catch drift.
- "End" is a single bucket today (`placed`). If we want to track
  rejections / withdrawals separately later, we'll either need another
  status (`rejected`, `withdrew`) or a secondary dimension — not yet
  modelled.

## Alternatives Considered

- **Replace the enum with exactly 5 stages matching the user's words
  (match, interview, proposal, contract, end).** Rejected because it
  collapses the veteran-side distinction between "system matched" and
  "I expressed interest" (different UX on the veteran side), and would
  force a data migration for every existing application.
- **Add a separate `funnel_stage` column on top of `status`.** Rejected
  as redundant — funnel stage is a pure function of status, so keeping
  it derived avoids an invariant that could drift.
- **Put the funnel inline on the existing dashboard.** Rejected because
  the funnel is inherently per-listing; cramming five vertical columns
  per listing into the dashboard would overwhelm the stats row and the
  cross-listing candidate preview.
