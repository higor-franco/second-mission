# 002 - MOS Translation Engine: O*NET Crosswalk Seed Data

**Status:** Accepted

## Context
The core product feature is translating military MOS codes into civilian career matches. We need a reliable data source for the initial mapping.

## Decision
Seed the database with real O*NET Military Crosswalk data scraped from onetonline.org. Store MOS codes, civilian roles (with O*NET SOC codes), and mappings with confidence scores and transferable skills. Initial seed covers 10 common E4-E6 MOS codes mapped to 30 civilian roles across logistics, maintenance, construction, energy, healthcare, and supply chain sectors.

## Rationale
O*NET is the authoritative U.S. government database for occupational information, maintained by the Department of Labor. Using real crosswalk data gives immediate credibility and accuracy. The mapping includes salary ranges from BLS data, making the translation instantly valuable to veterans.

## Trade-offs
**Pros:**
- Real, authoritative data from day one
- Covers the beachhead market (Fort Cavazos logistics/operations MOS codes)
- Salary data grounded in BLS statistics

**Cons:**
- Limited to 10 MOS codes initially (thousands exist)
- Match scores are manually assigned (future: AI-driven scoring)
- Static data — needs periodic refresh from O*NET updates

## Alternatives Considered
- **AI-only translation:** Would require training data we don't have yet; seed data gives us a working product immediately
- **Manual data entry:** Error-prone and not authoritative
- **O*NET API:** Would work for production but adds external dependency; seed data is self-contained
