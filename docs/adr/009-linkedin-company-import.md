# 009 - LinkedIn Company Import (employer profile pre-fill)

**Status:** Accepted

## Context

New employers sign up and land on `/employer/profile` with an empty form
they have to fill in by hand — company name, sector, location, a
description of what the company does. For a platform positioned as a
frictionless way for employers to start hiring veterans, that opening
form is a tax we can reduce.

Most employers already have a polished company description on LinkedIn.
The ask is: let them paste their LinkedIn company URL and have the form
pre-fill from that. Parallels the DD-214 AI extraction pattern on the
veteran side — it worked well there, and reusing the same mental model
keeps the product consistent.

**The LinkedIn access problem.** Unlike the DD-214 (which arrives via a
file upload the user already has in hand), LinkedIn aggressively blocks
scraping of public company pages:

- Non-logged-in requests frequently get served a "Sign in to view"
  login wall instead of page content.
- Status codes 403, 429, and the LinkedIn-specific 999 are returned
  liberally to bot-looking traffic.
- LinkedIn's Marketing Developer Platform / Sales Navigator APIs require
  partnership approval — not viable for a school project's MVP.
- Third-party scraping APIs (Proxycurl, Apify, etc.) sit in a legal gray
  zone (LinkedIn v. hiQ Labs) and add a paid dependency we don't need.

Any solution that relies on URL scraping alone will fail unpredictably.

## Decision

Build a hybrid import with a **URL-first path and a paste-text
fallback**, both routed through a single Claude extractor:

1. **URL path (best-effort).** Backend performs a polite HTTP GET with a
   desktop user-agent. Allowlisted to `linkedin.com` hosts. Strips
   `<script>` and `<style>` tags for clarity, then hands the raw HTML to
   Claude for extraction. Detects login walls (200 response with
   `"Sign in to view"` markers and no JSON-LD Organization schema) and
   returns a dedicated `ErrFetchBlocked` that the handler maps to HTTP
   422 + a clear "paste the About section" message.

2. **Text path (always works).** Employer pastes the LinkedIn About
   section into a textarea. Same Claude extractor, same output shape.
   The frontend surfaces the paste box every time the URL path fails and
   always keeps it visible once the employer expands the panel.

3. **Single extraction output.** Claude returns
   `{company_name, sector, location, description, tagline, industry_raw}`.
   `sector` is constrained to the platform's closed enum
   (Energy & Oil/Gas, Construction, Logistics & Supply Chain,
   Manufacturing, Field Operations, Maintenance & Repair, Other); the
   extractor rejects any value outside that list by blanking it, so the
   frontend dropdown just asks the employer to pick.

4. **Auth gate.** The endpoint `POST /api/employer/linkedin/extract`
   requires an authenticated employer session. Exposed only on the
   post-signup profile edit page.

5. **Activity logging.** Each successful import records to
   `activity_logs` as `linkedin_import` with `{source, url}` — we log
   the URL (useful for support) but never log the pasted text body or
   the extracted description.

Implementation lives in:

- `backend/internal/linkedin/extractor.go` — Claude-backed extractor.
- `backend/internal/linkedin/fetcher.go` — allowlisted HTTP fetcher.
- `backend/internal/handler/linkedin.go` — employer-facing endpoint.
- `frontend/src/components/LinkedInImportSection.tsx` — collapsible
  panel with both input paths and the paste-fallback UX.

## Rationale

**Why a paste fallback is not optional.** LinkedIn's bot detection makes
URL-only import unreliable enough that an employer could hit it once,
see a generic error, and never try again. The paste path is the one
guaranteed-to-work input. Surfacing both paths from the start — with
gentle copy about LinkedIn blocking some pages — sets the right
expectation up front.

**Why gate behind employer auth.** An unauthenticated extraction
endpoint would be a free LLM call for anyone who finds it, and would
happily process arbitrary text, not just LinkedIn content. Limiting to
authenticated employer sessions reuses the existing abuse-prevention
surface (registration + bcrypt + rate-limit at the session layer) and
keeps costs predictable.

**Why no registration-page integration (yet).** Exposing the endpoint
before the employer signs up would require either an open endpoint
(risk) or a throwaway "pre-signup" token (complexity). Neither is worth
it for a feature that works equally well the moment after the employer
creates their account. The post-signup profile page is the first thing
they see anyway.

**Why Opus 4.7.** Same model as the DD-214 extractor, per the project's
Anthropic API conventions (`shared/live-sources.md`: default to
`claude-opus-4-7` unless the user explicitly names another model). Cost
is bounded because import is on-demand and user-triggered, not a
background task. Running two different models for two similar
extraction features would add inconsistency without a real benefit.

**Why not prompt caching.** The system prompt is well under the 4096-
token minimum for prompt caching on Opus 4.7 — the cache would never
fire. Keeping the code path simple is worth more than an empty cache
decoration.

## Trade-offs

**Pros:**

- Cuts the tax of filling the profile form to effectively zero when the
  employer has a LinkedIn page (the overwhelming common case).
- The paste fallback means the feature *never* leaves the employer
  stuck — worst case they copy-paste, just like pre-AI onboarding.
- Mirrors the DD-214 pattern, so employers who saw the veteran-side
  demo already know how to use this.
- Sector-enum pinning means the form dropdown always stays valid.
- Activity log captures use (for admin visibility) without leaking the
  description or pasted text content.

**Cons:**

- URL fetch success is capped by whatever LinkedIn's bot detection
  allows today, and LinkedIn can tighten that at any time. The UX
  recovers gracefully, but "Fetch" will feel brittle for some pages.
- Depends on the same Anthropic API key as DD-214; an outage disables
  both AI features. The rest of the app keeps working.
- The LinkedIn fetcher is a regex-based HTML cleaner, not a full parser.
  Fine for feeding Claude, but brittle if LinkedIn ever delivers data
  in a fundamentally different shape (e.g., pure SPA with no server-
  rendered HTML). That's an observed risk, not a current issue.

## Alternatives Considered

- **Use a paid third-party scraping API (Proxycurl, Apify).** Rejected:
  adds a paid dependency, sits in the hiQ v. LinkedIn legal gray zone,
  and costs per call for a feature that should be occasional.
- **Use the LinkedIn Marketing Developer Platform API.** Rejected:
  requires partnership approval; the project can't secure that in
  time, and this feature doesn't need it.
- **Paste-only (no URL fetch).** Rejected: even though URL fetch fails
  frequently, when it works it saves the employer from copy-pasting a
  wall of text. The hybrid design costs almost nothing extra in
  complexity and delights the ~half of users for whom it just works.
- **URL-only (no paste).** Rejected: produces a dead-end when LinkedIn
  blocks, which is often.
- **Let the frontend do URL fetches via CORS.** Rejected: LinkedIn
  doesn't set permissive CORS headers, so the browser can't read the
  response body. Backend fetch is the only workable shape.
- **Enable the import on the registration form too.** Rejected for now
  — would need an unauthenticated endpoint, which creates abuse risk.
  Can be revisited later if demand is clear; for now, the extra two
  clicks after signup are negligible.
