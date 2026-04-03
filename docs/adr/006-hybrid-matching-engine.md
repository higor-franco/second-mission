# 006 - Hybrid AI Matching Engine

**Status:** Accepted

## Context

The platform's matching was purely database-driven: static MOS-to-civilian-role mappings from O*NET crosswalk data with pre-computed match scores. Every veteran with the same MOS code saw identical match scores regardless of their profile, preferred sectors, location, or the employer's specific preferences. This produced generic, one-size-fits-all results that didn't leverage the rich profile data both sides had already provided.

The PRD calls for "task-level matching (not job-title matching)" and "match confidence scoring based on skill overlap, location, availability" — requiring a multi-dimensional scoring engine.

## Decision

Build a hybrid matching engine that computes personalized scores by combining five weighted dimensions:

| Dimension | Weight | Signal |
|-----------|--------|--------|
| MOS Base Score | 35% | O*NET crosswalk mapping confidence (existing static data) |
| Skills Overlap | 25% | Fuzzy match of transferable skills against job tasks + requirements |
| Sector Alignment | 15% | Veteran's preferred sectors vs listing sector, with related-sector partial credit |
| MOS Preference | 15% | Whether the employer specifically requested the veteran's MOS code |
| Location Match | 10% | Texas region proximity matching (same city > same region > adjacent > distant) |

Scores are computed on-the-fly in the Go backend when a veteran views opportunities. The hybrid score replaces the raw MOS base score in the API response and is stored in `veteran_applications.match_details` as JSONB when a veteran expresses interest.

The engine lives in a dedicated Go package (`backend/internal/matcher/`) with pure functions and no database dependencies, making it independently testable.

## Rationale

- **Explainability over black-box:** Each dimension is transparent and the breakdown is shown to veterans. This builds trust — veterans understand *why* they match, not just *that* they match.
- **On-the-fly over batch:** Computing at request time ensures scores always reflect the latest profile data. No stale cache to invalidate.
- **Weighted combination over ML:** At this stage (10 MOS codes, 30 roles, ~30 listings), a hand-tuned weighted model outperforms ML in interpretability and reliability. ML can be layered on later when data volume justifies it.
- **Fuzzy skill matching:** Skills don't always use identical phrasing ("safety compliance" vs "safety protocols"). Word-level fuzzy matching handles natural variation without requiring a synonym dictionary.
- **Texas region mapping:** Geographic proximity matters for blue-collar roles that require physical presence. Region-based matching (Houston, DFW, Central Texas, etc.) with adjacency scoring is more useful than raw distance calculation for the beachhead market.

## Trade-offs

**Pros:**
- Fully explainable — each score dimension visible to the user
- Zero external dependencies (no ML service, no API calls)
- Sub-millisecond computation per listing
- Easy to tune weights as the platform learns from placement outcomes
- Works with current data volume (10 MOS codes, 30+ listings)

**Cons:**
- Weights are manually tuned, not data-driven
- Fuzzy matching is approximate — can miss semantic equivalences ("heavy lifting" vs "physical labor")
- Texas-specific region mapping needs extension for national expansion
- No learning loop yet — scores don't improve from outcomes

## Alternatives Considered

- **Pure ML embeddings (pgvector):** Would require a trained model and meaningful training data we don't have yet. Overkill for current scale, and would sacrifice explainability.
- **External AI API (Claude/GPT for scoring):** Would add latency, cost, and a dependency for every page load. Not viable for real-time matching.
- **Keep static scores only:** Simpler but doesn't use the rich profile data both sides provide. Misses the "task-level matching" differentiator from the PRD.
