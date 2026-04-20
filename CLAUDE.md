# CLAUDE.md — Second Mission
> Project briefing for Claude Code. Read this at the start of every session.

---

## What This Is

**Second Mission** is a two-sided workforce platform that connects transitioning military veterans (E4–E6 NCOs with logistics/operational backgrounds) to civilian roles in logistics, maintenance, construction, and field operations.

**Core thesis:** The U.S. has a structural blue-collar talent shortage (3.5M unfilled roles annually) AND a chronic misallocation of veteran skills in the civilian workforce (73% of veterans are underemployed in their first year). Second Mission solves both at once — framed as a market-relevant workforce solution, not a social impact charity.

**Institutional context:** Wharton AMP (Advanced Management Program), group project, team name "Beez Kneez." Final deliverable is a **real, functional web platform** — not a pitch deck, but a working product that demonstrates the full veteran-to-employer pipeline. Next faculty consultation: April 21, 2026.

---

## The Team

| Name | Role |
|---|---|
| Franco (Higor) | Project lead, driving strategy and product |
| Ludi (Ludivine) | Market research, competitor analysis, SkillBridge liaison |
| Pin Chuan | Deck consolidation, slide integration |
| Ale | Product design workstream |
| Johnny | USP workstream, next meeting chair |
| Suhail | Business model workstream |
| James (Jim) | Faculty advisor — critical voice, shapes all strategic decisions |

---

## Strategic Non-Negotiables (Jim's Flags)

These are constraints from advisor Jim. Do not propose anything that violates them.

**RED FLAG — Government funding dependency is structurally fatal.**
Revenue must come primarily from employer fees tied to ROI. Grant-dependent models die when a check is delayed three months. Government programs (SkillBridge, WOTC) are *enablers and accelerants*, not revenue sources.

**ORANGE FLAG — Hours-based education and consulting models are unviable.**
Any model that sells coaching hours or instructor time to people who can't afford it loses money. The platform must be outcome-based, not time-based. AI replaces the expensive human layer — that's the cost structure fix.

**CHALLENGE — Find a defensible competitive advantage.**
Jim's framing: upside potential, downside control, profit durability. The team's hypothesis: end-to-end pipeline coverage (awareness → translation → placement) is the gap no competitor fills. Needs to be validated and sharpened.

---

## Core Design Principles

1. **Task-based matching, not job-title matching.** Translate military operational experience into civilian task equivalents (e.g., "convoy logistics" → "field operations technician"). Competitors map job titles. We map what veterans actually *do*.

2. **Sell to ROI budgets, not CSR budgets.** The buyer is the VP of Operations with a labor shortage, not the VP of Diversity & Inclusion. This determines pricing model, sales motion, and pitch language.

3. **Free for veterans, paid by employers.** Veterans never pay. Revenue comes from employer subscriptions (pipeline access) + per-hire placement fees. WOTC tax credit facilitation ($2,400/hire avg.) is included as a value-add that reduces employer net cost.

4. **AI-powered skills translation engine is the core differentiator.** Not a human career counselor. Not a job board. An AI engine that reads MOS codes and outputs task-equivalent civilian role matches with confidence scores.

5. **Two-sided marketplace dynamics.** Both supply (veteran pipeline) and demand (employer demand) must be cultivated simultaneously. SkillBridge is an enabler — it provides a structured pathway. It is not a competitor.

6. **Platform to pipeline.** Less about technology, more about end-to-end flow. Problem is fragmentation and lack of awareness — not lack of programs.

---

## Beachhead Market

**Geography:** Texas — Fort Hood / Fort Cavazos as the named entry point.
**Cohort:** ~30 E5/E6 veterans per cohort.
**Anchor employer:** NOV (National Oilwell Varco), Houston. GE Renova also validated.
**Rationale:** Fort Cavazos is one of the largest U.S. Army bases, heavy logistical presence, and Texas industrial sector (energy, O&G, construction) has acute labor shortages. Ryan (NOV SkillBridge contact, met with Ludi on March 30) confirmed employer demand and validated the pipeline model.

**Positioning statement:**
> "We're building a direct pipeline from Fort Hood into high-demand industrial careers in Texas."

---

## The Four-Step Veteran Journey (Product Flow)

```
1. DISCOVER
   → Veteran learns what industrial careers pay and what they look like day-to-day.
   → Most veterans have never seen these options. Awareness is the primary gap.
   → Triggered at Fort Cavazos before separation.

2. TRANSLATE
   → MOS mapped to civilian job tasks (not titles).
   → AI engine outputs task-equivalent roles with match scores.
   → Example: MOS 88M (Motor Transport Operator) → Logistics Coordinator, Fleet Manager, Safety Compliance Officer.

3. MATCH
   → Pre-qualified candidates surfaced to employers.
   → Employer sees match score, availability date, civilian-translated skills.
   → WOTC eligibility flagged automatically.

4. PLACE
   → Direct employer introductions.
   → Interview prep.
   → Smooth first-day handoff.
   → No resume black hole.
```

Veterans are free throughout. Revenue is triggered at Match/Place.

---

## Competitive Landscape

### Direct competitors (veteran placement)

**Redeployable** — Closest analog. UK-founded startup using AI to map military skills to 1,000+ civilian career paths. "Job Drop" simulations let candidates try roles before applying. Hired cohorts by Honeywell and Schneider Electric. Moving toward industrial/infrastructure focus but still early there. Main gap: not deep in U.S. blue-collar industrial verticals.

**RecruitMilitary** — 30+ years, career fairs in 30+ cities, recently integrated Findem AI for profile enrichment. Volume player, not specialty industrial.

**Hire Heroes USA** — Nonprofit, resume/interview focused, no placement arm.

**FourBlock** — Nonprofit, 11-week cohort program, 12 physical sites, adjunct professors. Strong prep layer, strong base commander relationships. **Critical gap: zero placement arm.** No monetization of alumni. No employer relationships. FourBlock is a *potential supply partner*, not a competitor — they produce job-ready veterans who fall off a cliff at graduation. Colonel Abrams (founder) reacted positively to an advisor/partnership conversation.

**VeroSkills** — Recently identified. Similar skill-translation concept but no specific veteran focus. Ludi is booking a demo to deconstruct their model.

### Government tools (enablers, not competitors)
- DoD SkillBridge — structured internship bridge program before separation. Entry point for warm leads.
- DoL O*NET Military Skills Crosswalk — government translation tool, manual and incomplete.
- WOTC (Work Opportunity Tax Credit) — $2,400–$9,600 employer tax credit per veteran hired. Second Mission facilitates paperwork as a value-add.

### Other Beez Kneez concepts (not the primary focus)
- Crisis Supply Cloud — "AWS for humanitarian logistics," shared inventory marketplace
- Social Procurement B2B — ESG-compliant supplier marketplace (most mature existing competition: EcoVadis, Supplier.io, VendorPanel)
- Non-traditional talent matchmaking — incubator + matching + mentorship model

---

## FourBlock Intelligence (Primary Benchmark)

Meeting held by Suhail with Colonel Abrams (FourBlock founder). Key findings:

| Step | Their Process | Weakness |
|---|---|---|
| Early engagement | Base presence, ~1,000 candidates/year | Base-commander dependent — one leadership change can kill access |
| Vetting | Form → orientation → 15-min call → first-come-first-serve | No identification of "easy wins" or high-match veterans |
| Program | 11 weeks, once/week, adjunct professors, 12 physical sites | Long, expensive, quality varies, limits scale |
| Placement | **None** | **No monetization. No employer relationship. No ROI loop.** |

FourBlock's own AI ambitions: one volunteer in Colorado. Under-resourced.
Average cohort: 35 start, ~30 finish (5% no-show, 10% drop mid-program after finding a job independently).
Penn State-hosted research center validated FourBlock as top-ranked in the domain.

**Strategic implication:** Second Mission picks up exactly where FourBlock ends. Framing for pitch: "We pick up where the best prep program in the space leaves off."

---

## SkillBridge / NOV Intelligence (Primary Employer Benchmark)

Meeting held by Ludi with Ryan (NOV SkillBridge representative) on March 30, 2026. Key findings:

- NOV runs active SkillBridge programs in Texas industrial roles
- Primary gap Ryan identified: the **placement phase** — getting veterans from "program complete" to "hired"
- Employer-funded pipeline is the most viable model — employers are already spending to solve adjacent problems
- Awareness is the core gap for veterans, not skills — they don't know these careers exist
- "Platform to pipeline" framing resonated — less about tech, more about end-to-end flow
- GE Renova's program (hiring/training high school students for technical roles) noted as parallel model by Suhail

---

## Open Strategic Decisions

These three questions are the current live workstreams. All three trace directly to Jim's coaching flags.

**Q1 — Business Model** (Owner: Suhail)
What is the exact revenue structure? Options in play: subscription (employer pipeline access) + per-hire fee. Government programs as accelerants only. Need to model Q1/Q2/Q3 projections.

**Q2 — Product Design** (Owner: Ale + Franco)
What does the AI skills translation engine actually look like technically? Which steps are AI-driven vs. human-led? What is the MVP vs. full product?

**Q3 — USP** (Owner: Johnny)
What is the single defensible competitive advantage? Current hypothesis: end-to-end coverage (awareness → translation → placement) is the gap nobody fills. Needs sharpening against Redeployable, VeroSkills, and FourBlock.

---

## What's Already Been Built

- **Veteran homepage** — static HTML, brand "Second Mission," four-step flow (Discover → Translate → Match → Place), salary benchmarks, MOS-to-role translation UI, role cards for wind turbine tech / logistics coordinator / maintenance lead / safety officer
- **Employer homepage** — static HTML, candidate dashboard with match scores, availability dates, WOTC callout, pricing model (subscription + per-hire)
- **Meeting facilitation slide** — 1-slide PPTX used by Franco as chair, covering the three open decision areas (Business Model, Product Design, USP) with Jim's flags mapped to each
- **Strategic Word document** — comprehensive doc covering U.S. competitive landscape, international market analysis, quantitative market data, wage impact modeling, funding source mapping, coaching session debrief

---

## Key Data Points (Use in Copy and Pitch)

- 73% of veterans are underemployed in their first civilian year
- 3.5M blue-collar roles go unfilled across U.S. industry annually
- $68K+ average starting salary in matched industrial roles
- WOTC: avg. $2,400 per veteran hired (up to $9,600 for certain categories)
- FourBlock cohort size: ~35 veterans, 11 weeks, 12 sites, zero placement
- NOV SkillBridge: active Texas industrial programs, placement gap confirmed

---

## Frameworks in Use

- **Discovery-Driven Planning (DDP):** Establish success metrics before finalizing program design. Define assumptions explicitly.
- **Consumption chain analysis:** Map the veteran's full journey from awareness to first day on the job. Compare current state vs. Second Mission state.
- **Two-sided marketplace:** Supply (veteran pipeline) and demand (employer demand) must be cultivated in parallel. Classic chicken-and-egg problem — beachhead solves it by committing to one geography and one employer cluster.

---

## Tech Stack (In Progress)

No decisions finalized yet. When building, bias toward:
- **Backend:** Node.js or Python (whichever fits the task)
- **Frontend:** HTML/CSS for mockups, React if interactivity needed
- **AI/ML:** Skills translation engine is the core build — MOS code → task equivalents → match scoring
- **Data:** BLS occupation data, O*NET crosswalk as translation seed data

---

## Tone and Communication Rules

- No meta-framing, no playbook language, no "let's explore..." preamble
- Deliverables are clean and content-focused
- Franco communicates in Portuguese and English — outputs default to English unless specified
- When in doubt, build the thing. Don't ask permission to proceed on clear tasks.