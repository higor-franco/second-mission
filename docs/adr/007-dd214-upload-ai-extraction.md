# 007 - DD Form 214 Upload with Claude API Extraction

**Status:** Accepted

## Context

The existing MOS translation flow requires veterans to know — and correctly type or pick from a dropdown — their single Military Occupational Specialty code. In practice this has two problems:

1. **Awareness gap.** Many E4-E6 NCOs don't remember their exact MOS code; they remember the job title or their day-to-day role. The project's own research (FourBlock meeting, NOV/SkillBridge conversations) consistently flags awareness as the top friction point.
2. **Single-MOS limitation.** A veteran who served 8 years rarely held just one MOS. They pick up secondary specialties, ASI/SQI identifiers, military education, and decorations that change what civilian roles are a good fit. Forcing the UI down to a single MOS erases most of their actual career surface area.

The DD Form 214 is the U.S. military's canonical separation document. Every transitioning service member has one, and it contains every piece of career information the matching engine could want (primary MOS, secondary MOS, ASI/SQI, rank, paygrade, total active service, military education, decorations, branch).

## Decision

Add a tabbed UI on the `/translate` page offering two input paths:

- **"I know my MOS"** — the existing dropdown + manual translate flow (unchanged)
- **"Upload my DD-214"** — a new path that accepts a PDF (max 10 MB), sends it to Anthropic's Claude API via the official Go SDK for structured extraction, aggregates civilian role matches across every MOS recognized in the crosswalk, and returns the combined result

The backend route is `POST /api/dd214/translate` (public, no auth). The PDF is processed in memory and discarded once extraction completes; no file or PII is persisted.

Extraction uses `claude-opus-4-7` with a JSON-only prompt. The Go `dd214.Extractor` owns the full Anthropic API round-trip; the HTTP handler consumes it through an interface (`handler.Extractor`) so tests can swap in a fake without a live API key.

## Rationale

- **Fits the project thesis.** The PRD and pitch materials explicitly call the "AI-powered skills translation engine" the core differentiator. An LLM that reads the actual DD-214 — including scanned forms — is the most honest fulfillment of that claim, and it's a demoable moment for the Wharton AMP review.
- **Works on day one without an OCR/regex stack.** Claude's native PDF input accepts both text-based PDFs and scanned images, so we skip maintaining a pre-OCR pipeline and the brittle regex patterns that come with it.
- **Turns a single-MOS UX into a multi-MOS UX.** Aggregating civilian role scores across every recognized MOS (keeping the best score per role, unioning transferable skills) is strictly additive: a veteran who was both 88M and 92Y now sees the union of both crosswalks, scored by whichever path matches best, and role cards surface the MOS that produced the match.
- **Stateless and privacy-preserving by default.** The PDF never touches disk; the extractor sees bytes in memory, returns a struct, and the bytes are released for GC. The UI explicitly tells the user this.
- **Fail-safe when the key isn't configured.** When `ANTHROPIC_API_KEY` is unset, the server starts normally and the endpoint returns `503` instead of crashing — so deployment, CI, and local testing continue to work without a key.

## Trade-offs

**Pros:**
- Matches the project's "AI-first" positioning for the Wharton demo
- Removes the "what's my MOS?" friction for the most common veteran persona
- Multi-MOS aggregation produces richer, more defensible matches than the single-MOS flow
- In-memory processing keeps the privacy story clean (DD-214 contains SSN/DOB)
- The `Extractor` interface means handler tests don't need a live API key

**Cons:**
- Adds a per-upload cost (approximately $0.01–$0.03 per DD-214 via Claude Opus 4.7 with adaptive thinking). Acceptable for an early-stage product; monitor usage as volume grows.
- Adds an external runtime dependency (Anthropic API). If the API is unreachable the upload endpoint returns `502` and the user is told to retry or fall back to manual MOS entry — but this is a real new failure mode.
- Claude's JSON output is tolerant but not perfectly deterministic. `parseProfile` handles fenced JSON and prose padding, but in rare cases extraction will fail with `ErrInvalidJSON` and the user will need to retry.
- PDF-only in v1. A veteran with only a phone photo of their form can't use the feature yet.

## Alternatives Considered

- **OCR + regex pipeline (pdftotext → pattern matching).** Free and deterministic, but DD-214 has multiple revisions (1950, 1962, 1984, 2000, 2014), carbon-copy layouts, and plenty of handwritten service records. The engineering cost to keep up with real-world variance is substantial, and the failure mode is silent (wrong fields extracted) rather than loud (model returns an error we can display). Rejected for v1; may be added as an offline fallback later.
- **Hybrid Claude primary + regex fallback.** Considered, then rejected for v1 to contain scope. The fallback adds ~200 LoC and a full second code path before we have any real-world signal on how often Claude extraction actually fails. If observed failure rate justifies it, we'll add it.
- **Client-side extraction with a browser PDF library.** Can't read scanned PDFs without an OCR step, and the extraction schema would have to ship in the frontend bundle. Rejected.
- **Storing the DD-214 encrypted in the database.** Tempting for "re-run matching later" semantics, but DD-214 carries SSN, DOB, and sometimes home-of-record — we'd be taking on a compliance footprint we don't need yet. Rejected. If needed later, SSN-redaction at extraction time + encrypted-at-rest storage is the path.
- **Requiring sign-up before upload.** More conservative privacy-wise, but the primary goal of the translate page is top-of-funnel conversion. Gating the "wow moment" behind a sign-up wall kills that. We chose public upload with an explicit in-memory/never-stored disclaimer.
