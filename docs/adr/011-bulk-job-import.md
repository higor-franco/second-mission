# 011 - Bulk Job Import from Careers Page or Paste

**Status:** Accepted

## Context

Our Wharton AMP faculty consultation surfaced the "chicken and egg"
problem baked into any two-sided marketplace: a veteran won't sign up
unless there's a visible pipeline of real jobs, and an employer won't
take time to post unless there's a visible pipeline of real candidates.
We'd been planning to break the cycle by landing employers first and
letting them post manually — but the advisor (Martin) flagged a sharper
move: *import the jobs the employer has already published elsewhere*.
"If you went to an employer and said 'we just took the liberty of
importing your jobs' — that's going to make your sales process easier."

We already had the architectural pieces in place. The LinkedIn
company-profile import (ADR 009) showed that Claude Opus 4.7 could turn
messy HTML into structured profile data in under a second, behind a
handler that degrades gracefully when the fetch is blocked and falls
back to user-pasted text. The same pattern, pointed at a careers page
and extended to return an array of postings with matched civilian-role
ids, gets us 90% of what Martin described.

Scope constraint: this ships the day after the consultation meeting, so
it has to use battle-tested patterns from the codebase rather than
inventing new ones, and it has to be demoable without scraping a real
Fortune 500 careers page (many of which are JavaScript-rendered and
would return an empty shell to a server-side fetch).

## Decision

1. **New Go package `internal/jobimport`** mirroring `internal/linkedin`
   exactly — an `Extractor` that wraps the Anthropic SDK, a `Fetcher`
   that retrieves careers-page HTML, and shared sentinel errors.
2. **Generalized fetcher.** Unlike the LinkedIn fetcher (which is
   allow-listed to `linkedin.com`), the job-import fetcher accepts any
   public https URL. Because that widens the SSRF surface, we added
   defense-in-depth:
   - `validateURL` rejects non-https, bare `localhost`, and any host
     that resolves to a private / loopback / link-local / multicast
     address. Cloud metadata service (169.254.169.254) explicitly
     blocked too.
   - The `http.Transport.DialContext` also re-resolves the hostname and
     rejects private IPs at socket-open time, which catches a DNS
     rebinding race that `validateURL` alone can't defend against.
   - Redirects are followed but each hop re-runs `validateURL`.
3. **Extractor returns `[]JobDraft`, not a single profile.** The
   schema per draft carries everything the existing create endpoint
   needs (title, description, requirements, tasks, benefits, location,
   salary band, employment type, MOS preferences, WOTC flag) plus a
   `civilian_role_id` that Claude picks from a catalog we pass in the
   prompt. Drafts Claude can't confidently map get `civilian_role_id =
   null`; the review UI then forces the employer to pick before
   publishing. The handler validates every returned `civilian_role_id`
   against the catalog before returning the drafts to the frontend so
   hallucinated IDs never reach the review surface.
4. **Nothing persists server-side in this endpoint.** Drafts live in
   the response body. The employer reviews them in the UI, edits any
   fields in-line, and publishes each one by POSTing to the existing
   `POST /api/employer/listings` — the same path a hand-typed listing
   flows through, with the same validation and activity logging. Two
   consequences:
   - No new DB schema. The `job_listings` table is untouched.
   - Every published listing goes through the regular `create_listing`
     activity-log event. Bulk import adds a distinct
     `jobs_bulk_import` event that captures `{source, url, count}` —
     never the text body or extracted descriptions, which may be
     pre-publication and sensitive.
5. **UX parity with LinkedIn import.** A collapsible chip on the
   employer dashboard opens a panel with both inputs visible
   simultaneously: URL input (happy path) and paste textarea
   (fallback). On a 422 or 502 from the backend — SPA-rendered
   careers pages, login walls, Cloudflare challenges — the paste
   textarea gets a soft highlight and the employer keeps going.
6. **Review-and-publish UI.** Each extracted draft renders as a card
   with editable title, location, salary, description, tasks, and a
   civilian-role dropdown populated from `/api/civilian-roles`. Per
   card: **Publish** (disabled while `civilian_role_id` is null),
   **Discard**, and **Edit details** (expands the description + tasks
   editors). A **Publish all** button at the top iterates sequentially;
   a batch endpoint is out of scope for v1 (a 20-draft import is 20
   round-trips at ~100 ms each, which is acceptable for now).
7. **Model and prompt.** Same `claude-opus-4-7` used by the two other
   extractors. Prompt is pinned to JSON-array output (with a fence-
   tolerant parser), embeds the civilian-role catalog inline, and hard-
   caps Claude to 20 drafts per call. 4096 output tokens is the budget.
8. **Degradation when ANTHROPIC_API_KEY is missing.** Endpoint is
   registered at startup regardless; handler returns 503 if the
   extractor didn't initialize. Same shape as the DD-214 and LinkedIn
   endpoints.

## Rationale

- **Pattern reuse over novelty.** The LinkedIn handler is production-
  tested and the frontend component shape is familiar to Claude-era
  users. Copying that pattern (extractor / fetcher / handler + single
  React component) kept total implementation under a day.
- **SSRF hardening at the network layer, not the URL string.** A
  host-string allowlist is brittle (case sensitivity, punycode,
  percent-encoded hosts, DNS rebinding). Doing the check at
  `DialContext` on the actual resolved IP is the only approach that's
  correct in every edge case. The extra `validateURL` up front provides
  fast feedback for the common "pasted a local dev URL by mistake"
  case.
- **Nothing persists until Publish.** The alternative (write drafts as
  inactive listings) would have required a new `is_draft` column, new
  list/filter queries, and an employer-side draft-management UI. Given
  the demo-grade timeline and the fact that the existing listings table
  already has an `is_active` flag for the same purpose, keeping drafts
  in memory is the right trade.
- **civilian_role_id nullable in the contract.** Claude will sometimes
  score a posting below the 0.6 confidence threshold we ask it to hold
  itself to. Forcing a guess would produce bad match scores downstream;
  forcing the employer to pick keeps the matcher honest.
- **Generalizing the fetcher vs. forking it.** We briefly considered
  extracting a shared `fetcher` package across linkedin + jobimport.
  Rejected for now: the two have different allowlist semantics
  (LinkedIn-only vs. public-any) and the cost of duplication is 60
  lines of code. We can DRY this up later if a third extractor shows
  up.

## Trade-offs

**Pros:**
- Removes the #1 "why would I sign up" friction for new employers —
  they arrive and 5-20 roles are already pre-structured and ready to
  publish.
- Zero new DB schema, zero new tables, zero migration risk before the
  final pitch.
- The paste fallback means even fully-SPA careers pages (many modern
  employers) work — the employer copies the listings and we still
  save them the typing.
- Sales narrative: "we pre-loaded your jobs from your own site" is a
  demonstrably stronger opener than "please type 10 job descriptions
  into our form."

**Cons:**
- **Careers-page SPAs return empty shells on server-side fetch.** Real
  impact is ~40-50% of Fortune 500 careers pages are Greenhouse or
  Lever embeds rendered client-side. Our paste fallback catches this
  but the employer has to do one extra step.
- **Cost envelope.** Each import is one Opus call with up to 64 KB
  input + up to 4096 output tokens. For the expected volume (one-off
  during onboarding) this is negligible, but if we later automate
  nightly re-imports for every active employer we'll want to revisit.
- **No deduplication.** An employer could run the import twice against
  the same URL and get the same 10 drafts again. The review UI gives
  them the choice to discard, which is fine for v1 — a
  per-employer "has this URL been imported before?" check can land
  later.
- **Civilian-role mapping is only as good as the catalog.** For a
  well-covered sector like Logistics the matches are solid; for a
  niche sector (Healthcare, Field Ops) the catalog has only 1-2
  entries and Claude's choice may not feel tight. The review
  dropdown is the escape hatch.

## Alternatives Considered

- **LinkedIn Jobs API.** Requires a formal LinkedIn Partner agreement
  and app review — months, not days. Rejected for v1; the pasted-text
  path handles LinkedIn listings just fine.
- **Indeed or Greenhouse APIs.** Similar partner-agreement gating.
  Generalizing on arbitrary URL lets us handle these via a user paste.
- **Admin-side pre-import for prospective employers.** The original
  advisor suggestion was "pre-load jobs before the employer even signs
  up, then use that as sales material." Rejected for v1 because it
  needs a placeholder-employer concept, an assignment flow on signup,
  and an admin UI none of which fits the pre-pitch window. Documented
  as a v2 extension.
- **`is_draft` column on `job_listings` to persist drafts server-side.**
  Over-engineered for the current ask (see Rationale). Worth revisiting
  if employers report losing drafts mid-review.
- **Separate batch `POST /api/employer/listings/bulk` endpoint.**
  Minor performance win for 20-draft imports. Rejected for v1; the
  sequential loop is clear, testable, and fast enough for
  demo-grade.
