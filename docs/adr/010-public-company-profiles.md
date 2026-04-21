# 010 - Public Company Profiles for Veterans

**Status:** Accepted

## Context

Until now, veterans only saw the employer's name and headquarters location
on an opportunity card — a single line of text with no way to research the
company before expressing interest. Feedback from Franco (and implied by
Jim's "we're selling to ROI buyers, not CSR buyers" framing) is that
veterans behave like any other job seeker: before they apply they want to
know **who the employer is** — website, LinkedIn presence, company size,
industry, how long they've been around. A marketplace that hides that
context asks candidates to blind-apply, which works against the
"transparency end-to-end" thesis the platform is built on.

Two things needed to happen at once:

1. The employer profile record had to carry enough identity metadata to
   answer those questions (website, LinkedIn page, size band, founding
   year) — the existing schema only had name, sector, location,
   description.
2. Veterans needed a destination page (not just a richer card) where all
   of that information could live, alongside the employer's currently-open
   listings.

This decision also touches the landing-page FAQ, where we updated the
commercial framing to make clear the platform is in an open beta and free
for everyone — not just veterans — during the testing period.

## Decision

1. **Add public-facing columns to `employers`** via migration 012:
   `website_url`, `linkedin_url`, `company_size`, `founded_year`. All are
   non-nullable with safe defaults (`''` / `0`) so existing rows stay
   valid without a destructive backfill; the migration also populates
   realistic values for the 10 seeded Texas employers so the demo looks
   real.
2. **New veteran-facing endpoint** `GET /api/veteran/employers/:id`
   returning `{ employer, listings }`. Employer shape is a deliberately
   trimmed `publicEmployerResponse` (no `email`, no `password_hash`, no
   `contact_name`) — we only expose what the employer chose to publish.
   Listings come from a new `ListActiveJobListingsForEmployer` query that
   filters to `is_active = true`.
3. **Veteran-only access.** The handler inspects the session and rejects
   anything other than `user_type == 'veteran'`. This prevents an employer
   from using the candidate-facing endpoint to scrape competitors (a real
   concern in two-sided marketplaces). Employers can always see their
   own profile via the existing `/api/employer/me`; they do not need a
   public-profile-by-id endpoint.
4. **New React page** `/companies/:id` rendered by `CompanyProfilePage`.
   Identity block at the top (name, sector/size/founded chips,
   headquarters, website + LinkedIn buttons), description section, then
   active listings. Each listing deep-links to `/opportunities` where the
   hybrid match score is computed for the signed-in veteran (we don't
   duplicate match logic on the public page).
5. **Linked company names** on both `OpportunitiesPage` and
   `ApplicationsPage` — the company name already appeared; it now
   renders as a `<Link to="/companies/:id">` when `employer_id` is
   non-zero and falls back to a plain `<span>` for legacy listings
   without an `employer_id`. Added `EmployerID` to the opportunity and
   application response shapes so the frontend can build the link
   without a second fetch.
6. **Extended `EmployerProfilePage`** with a "Public Company Info"
   section wrapping the four new fields, including a small helper link
   to `/companies/:id` that opens the same page veterans will see — the
   employer gets instant feedback on how their edits will render.
7. **Safety rails on external URLs.** The page sanitizes the LinkedIn URL
   through `safeLinkedIn()` — the chip only renders when the hostname
   matches `linkedin.com` or a subdomain. This is defense-in-depth; the
   employer form already scopes the input, but the public page treats the
   field as untrusted so a misbehaving employer can't turn their LinkedIn
   chip into a redirect into anywhere.
8. **FAQ restructuring** — a new PLATFORM-audience entry at the very top
   frames the platform as an open beta and commits to being free for
   both veterans and employers during the testing period; the employer
   pricing entry repeats the "Free during the current beta" wording so
   it's visible in context.

## Rationale

- **Two-sided marketplaces need trust on both sides.** The employer side
  already has candidate-facing data (match scores, MOS, profile). Adding
  a public profile closes the symmetric gap on the veteran side. Cost is
  low (one new endpoint + one page), payoff is high (better-qualified
  click-throughs on Express Interest).
- **Keeping the new columns on `employers`** (rather than a separate
  `employer_profiles` table) is simpler for a project at this scale and
  keeps the admin `ListAllEmployers` query unchanged. A separate table
  would only make sense if we needed versioning or translations, neither
  of which we do.
- **Veteran-only access with explicit session-type check** is the right
  default for a competitive hiring platform. Sharing the trimmed
  `publicEmployerResponse` publicly (no session) is tempting — it would
  help SEO and invite-link sharing — but it also means an employer can
  scrape the table without logging in, and we lose the `activity_logs`
  signal we get from authenticated access. If we later want public SEO,
  we can add a separate route under the unauthenticated marketing
  surface.
- **`founded_year = 0` sentinel** avoids a nullable int32 in sqlc/pgx,
  which would force `pgtype.Int4` and a companion `.Valid` check at every
  read site. Backend treats `0` as "unknown" and the frontend hides the
  chip when it's 0.
- **LinkedIn URL sanitization on the public page** defends against the
  form validation drifting later — either because we add a new admin
  import path, or because we change the extractor to be more permissive.
  The public page is where the link actually gets clicked, so that's the
  right place for the guard.
- **The beta disclosure in the FAQ** is as much a commercial decision as
  a product one — Jim's coaching flagged the importance of keeping the
  long-term pricing story intact while honestly signaling current
  status. The FAQ does both.

## Trade-offs

**Pros:**
- Low-risk, additive schema change — no migrations on existing data, no
  compatibility breaks for clients that haven't updated yet.
- Single public endpoint covers the common case (profile + open roles)
  in one round trip — no N+1 fetches from the frontend.
- Veteran-only access matches the competitive reality of the space
  without requiring a full RBAC rewrite.
- The employer-side form gets an immediate "see what candidates see"
  affordance that will help us collect richer profiles without a CSR
  intervention.

**Cons:**
- We now have veteran-facing surface area that exposes employer data we
  didn't previously expose. An employer could be surprised that the
  profile is fully public within the platform; the form copy mitigates
  this ("Displayed on your public /companies/:id profile page") but we
  should monitor feedback.
- The match score is not computed on the company profile page. A veteran
  who lands there from an external link would need to click through to
  `/opportunities` to see the score. Acceptable for v1 — the company
  profile is a research destination, not a matching surface.
- LinkedIn extraction doesn't yet pre-fill the three new fields
  (website, size, founded year). The form still works because the
  employer fills them in manually; we'd want to upgrade the extractor
  prompt in a follow-up to close that loop.

## Alternatives Considered

- **Richer tooltip on the opportunity card** (show the extra employer
  info inline when the user hovers) — discarded because it would have
  shown the same data in every card and not given the employer a
  destination URL to share in recruiting outreach.
- **Public-to-anyone company profile** (no session required) — discarded
  to avoid giving competitors a free scrape of the employer base. Can be
  revisited later for SEO / marketing.
- **Separate `employer_public_profiles` table** — discarded as
  over-engineering for this scale; see Rationale.
- **Nullable `founded_year` via `pgtype.Int4`** — discarded because 0 is
  a perfectly good sentinel and avoids nullability noise at every call
  site.
