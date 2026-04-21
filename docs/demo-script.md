# Second Mission — Demo Script

**Audience:** Big audience / PoC demo (Wharton AMP faculty, peers, advisor panel, employer pilots).
**Total time:** ~12 minutes live + ~5 minutes Q&A = **17 minutes**.
**URL:** https://second-mission.com
**Speaker:** Franco (primary), with teammates available for Q&A.

---

## Pre-Flight Checklist (do this 30 minutes before you go on)

### Accounts to pre-create in production
- **Veteran account**: `demo-vet@secondmission.demo` — complete profile with MOS 88M, rank E-5, 6 years service, Killeen TX, preferred sectors Logistics + Energy. At least one application at each funnel stage.
- **Employer account**: log in as `hiring@nov.com` (seeded). Make sure it has 3–4 active listings and at least one listing with a richly populated funnel (one candidate in each of Match, Interview, Proposal, Contract, End).
- **Admin account**: not needed for the core demo, but have `/admin` credentials on hand in case of Q&A.

### Browser setup
- **Two browser profiles** (or two windows — one private, one regular). Label them "Veteran" and "Employer" in sticky notes if projecting. Prevents confusing session switching mid-demo.
- Veteran profile logged into **https://second-mission.com/dashboard**.
- Employer profile logged into **https://second-mission.com/employer/dashboard**.
- Both windows loaded and kept warm — LinkedIn API extraction takes 2–4 seconds; show that you've rehearsed.

### Files to have ready
- A sample DD-214 PDF on the desktop (named `sample-dd214.pdf` — obvious for an audience that can see your screen).
- The LinkedIn "About" text for NOV or another recognizable employer in your clipboard.
- This script open on a second monitor or printed.

### Network / backup
- Have the screenshots in `/tmp/` available as fallbacks: `faq-viewport.png`, `emp-detail.png`, `li-profile-imported.png`. If the live site dies mid-demo, switch to screenshots and keep talking.
- Consider running the local dev environment (`second-mission.com` → `localhost:5173`) as a hot fallback. Same data flows, just a different URL to say.

---

## The Script

### 0:00 – 0:45 | OPEN (45 seconds)

**Say:**
> "73 percent of American veterans are underemployed in their first year out of uniform. In the same labor market, 3.5 million blue-collar jobs — logistics, heavy equipment, oilfield services, maintenance — go unfilled every year. Those aren't two problems. They're the same problem, on opposite sides of a market gap nobody's closing.
>
> Second Mission is a two-sided workforce platform that closes that gap — not as a charity, but as a market-relevant workforce solution. Free for veterans. Paid for by employers who are already losing money to the labor shortage."

**Do:** Land on **https://second-mission.com** (fresh tab, full screen, no dev tools visible).

**Key numbers to land hard:** 73% underemployment, 3.5M unfilled roles. Say them slowly; let them sit.

---

### 0:45 – 1:30 | THE LANDING PAGE (45 seconds)

**Do:** Scroll slowly down the page. Don't rush.

**Say while scrolling through each section:**

1. **Hero** — "MILITARY SKILLS. CIVILIAN CAREERS. Two CTAs — one for veterans, one for employers. Both sides of the marketplace land on the same page."
2. **Stats bar** — "Four numbers the industry already knows but nobody's solving together: underemployment, open roles, average salary after placement, and the WOTC tax credit per veteran hire — that number is how we align employer economics."
3. **Four-step journey** — "Discover, Translate, Match, Place. The veteran's full funnel from 'never heard of this career' to 'first day on the job.' We'll walk through it live in a moment."
4. **Careers waiting** — "These aren't hypothetical. Wind turbine tech, logistics coordinator, construction manager — actively hiring in our beachhead market."
5. **For Employers** — "Four reasons the VP of Operations — not the VP of D&I — signs the check: pre-qualified pipeline, task-level matching, WOTC facilitation, reduced time-to-hire."
6. **FAQ** — *(scroll through briefly)* "Eight questions we get on every first call, answered up front. Is it free for veterans, how is this different from a job board, how does matching work, how does pricing work."

**Time check:** you should hit the bottom of the page at about 1:30.

---

### 1:30 – 2:00 | THE THESIS (30 seconds)

**Do:** Scroll back to the top. Pause. Make eye contact.

**Say:**
> "Three things make this work. One: task-level matching — we map what a veteran actually *did* — convoy logistics, field maintenance, small-team leadership — to civilian roles that need those same skills. Not titles. Two: AI skills translation — the engine reads a DD-214 and turns it into a civilian work history in seconds. Three: WOTC-aligned pricing — we charge employers, and the tax credit offsets most of what they pay. Employer is net positive on the first hire.
>
> Let me show you."

---

### 2:00 – 6:00 | VETERAN FLOW (4 minutes) — the "wow moment" side

Switch to the **Veteran browser window** (already signed in).

#### 2:00 – 2:45 | Dashboard overview

**Do:** Navigate to `/dashboard`.

**Say:**
> "This is what a veteran sees. Every veteran works through this four-step journey — Discover, Translate, Match, Place — and the dashboard is their home base."

**Point to:**
- **Welcome header** — "Name and MOS front and center."
- **Your Journey tracker** — "Four steps, current step highlighted. Auto-advances based on activity — no manual updating."
- **Stats row** — "Career matches, average match score, active applications, placements. All live."
- **Matched Jobs panel** — "Right-sized to the MOS. We'll click through in a second."
- **Pipeline Status** — "Applications grouped by funnel stage. Matches the same pipeline the employer sees — nobody has to guess where they stand."

#### 2:45 – 3:45 | The DD-214 magic moment

**Do:** Navigate to `/profile`. If this is a returning veteran, click the **Dashboard → Profile** nav to land on the edit form. For maximum impact, use a fresh account so they see the fork ("Upload DD-214" vs "Enter manually").

**Say:**
> "New veterans land on a fork. The recommended path — upload a DD-214. Claude reads the full form in about three seconds, extracts every MOS, every service school, every decoration. I'll show you."

**Do:**
1. Click **Upload my DD-214**.
2. Upload `sample-dd214.pdf`.
3. Click **Analyze & pre-fill profile**.

**While it runs (3–4 seconds):**
> "We're sending the PDF to Claude Opus 4.7 as a native document — no OCR, no text extraction step. Claude reads the form visually, the same way a person would."

**When results appear:**

Point to:
- **Name** pre-filled.
- **MOS code** pre-filled (e.g., 88M).
- **Rank, paygrade, years of service, separation date** all populated.
- Green success banner: **"We read 2 recognized MOS codes off your form and matched you to 8 civilian roles"**.

**Say:**
> "Everything's pre-filled. The veteran reviews, adjusts anything that's off, hits save. Same quality of data we'd get from a 30-minute intake call, in thirty seconds."

#### 3:45 – 5:00 | Opportunities with explainable AI

**Do:** Click **Opportunities** in the nav.

**Say:**
> "This is the 'wow' moment that drives sign-ups. Veterans have never seen these careers before. Here's what matches an 88M — Motor Transport Operator."

**Point to the first opportunity card:**
- **Match score circle** (e.g., 91%)
- **Sector badge** and salary range
- **AI MATCH label** with explanation text

**Do:** Click the match score or "Why this match?" to expand the **score breakdown panel**.

**Say:**
> "This isn't a black box. Every match score breaks down into five dimensions — MOS base match, skill overlap, sector alignment, the employer's MOS preferences, and location proximity. The veteran sees exactly why a role fits, and which of their skills transferred."

**Do:** Click **Express Interest** on the top-matched role.

**Say:**
> "One click to express interest. The employer sees them on their side instantly. Journey step advances. Pipeline populated."

#### 5:00 – 6:00 | The veteran pipeline

**Do:** Click **My Pipeline** in the nav.

**Say:**
> "Same five stages both sides see: Match, Interview, Proposal, Contract, End. Real-time. No resume black hole. If the employer extends an offer, the veteran sees it the same second."

**Point to:**
- Applications in each stage.
- Any placed application (Hired! badge in green).

---

### 6:00 – 10:00 | EMPLOYER FLOW (4 minutes) — the operational side

Switch to the **Employer browser window**.

#### 6:00 – 6:45 | Employer dashboard

**Do:** Navigate to `/employer/dashboard`.

**Say:**
> "This is what NOV sees. The employer's job is simple — post roles, browse candidates, move them forward."

**Point to:**
- **Company name header** (NOV (National Oilwell Varco)).
- **Stats row** — Active Listings, Total Listings, Candidates, Placements.
- **Job Listings panel** — each row a clickable link with "View details & funnel →".
- **Candidates panel** — cross-listing feed of interested veterans with match scores.

#### 6:45 – 8:30 | Listing detail + hiring funnel (the commercial differentiator)

**Do:** Click the first listing — **Fleet Operations Manager**.

**Say:**
> "This is the hiring manager's workspace. Full listing at the top — description, tasks, requirements, benefits, preferred MOS codes. Quick actions: Pause, Activate & Relist, or Edit."

**Do:** Scroll down to the **Hiring Funnel** section.

**Say:**
> "Here's where operational clarity turns into dollars. Every candidate for this one role, bucketed by stage — Match, Interview, Proposal, Contract, End. Five columns, one glance, the hiring manager knows exactly where every candidate is."

**Point to each column:**
- **MATCH** — "System matched + the veteran expressed interest."
- **INTERVIEW** — "Introduced and in interviews."
- **PROPOSAL** — "Offer extended."
- **CONTRACT** — "Contract signed, awaiting start."
- **END** — "Placed. Hired. Commission triggered."

**Do:** On a candidate in the MATCH column, click **Introduce →**.

**Say:**
> "One click moves them to the next stage. The veteran sees the status change on their side the same second. We're closing the loop the industry has left open for thirty years."

#### 8:30 – 9:15 | Edit and relist

**Do:** Click **Edit Listing**.

**Say:**
> "If the role evolves — salary band changes, a new requirement, they want to reactivate a paused listing — the employer edits in place. No re-posting, no lost history. Match scores stay stable because the civilian role category is pinned."

**Do:** Scroll through the form briefly. Don't actually save anything.

#### 9:15 – 10:00 | The LinkedIn import moment

**Do:** Navigate to `/employer/profile` (click **Company Profile** in the nav).

**Say:**
> "New employers come to us through cold outreach or referral. Typing their company profile from scratch is the first tax we remove."

**Do:** Click the **Import from LinkedIn** chip at the top. Panel expands.

**Say:**
> "Paste your LinkedIn company page URL, or paste the About section. LinkedIn blocks automated fetching on most public pages, so we handle both paths — same AI extraction either way."

**Do:** Paste the NOV About text into the textarea. Click **Extract from text**.

**While it runs (2–3 seconds):**
> "Claude is reading the company description, picking the closest fit from our sector enum, formatting the location, and condensing the description to something the form field can hold."

**When results appear:** Point to the green success banner **"Imported from LinkedIn (pasted text)"** and the pre-filled form fields.

**Say:**
> "Company name, sector, location, description — all pre-filled. The employer reviews, saves. Fifteen seconds instead of fifteen minutes."

---

### 10:00 – 11:00 | THE MOAT (60 seconds)

**Do:** Flip back to the browser with both windows visible, or go back to the landing page.

**Say:**
> "What we just showed you is three things competitors don't have.
>
> **One: end-to-end coverage.** Awareness to placement in one platform. Hire Heroes does resume prep. FourBlock does the classroom. RecruitMilitary does the career fair. Nobody else owns the full pipeline.
>
> **Two: task-level AI matching with explainable scores.** O*NET gives you a static crosswalk. Claude gives us a matching engine that reads DD-214s, scores candidates across five dimensions, and shows veterans *why* they're a fit.
>
> **Three: ROI-aligned pricing.** We sell to the VP of Operations with the labor shortage, not the VP of Diversity with the CSR budget. WOTC covers most of the employer's cost. Fort Cavazos veterans staffing a Houston oilfield operation — that's not a charity. That's a workforce solution."

---

### 11:00 – 12:00 | CLOSE (60 seconds)

**Say:**
> "Everything you just saw is live at **second-mission.com** — real database, real AI, real Texas employers seeded. Our beachhead is Fort Cavazos feeding NOV, GE Vernova, KBR, Fluor. Next 90 days we're building our first cohort of veterans, running the pipeline end-to-end, and bringing back the one metric that matters for Q2: placement rate by cohort.
>
> Questions?"

---

## Q&A Preparation

Below are the questions to expect — especially from Jim — and the answers that keep the thesis intact.

### Commercial / business model

**Q: What's your unit economics? How do you make money?**
A: Monthly subscription per employer for pipeline access (target ~$2K/month, price TBD post-pilot). Plus a per-hire placement fee (target 15–20% of first-year salary). On a $75K placement that's $11–15K. WOTC offsets the employer's cost by $2,400–$9,600. Most employers are net positive on the first hire. We're still validating these numbers with NOV in Q2.

**Q: Why aren't you dependent on government funding? SkillBridge pays for training.**
A: Jim was clear on this one — grant-dependent models die when a check is delayed three months. SkillBridge is an enabler, not a revenue source. It's a warm lead channel: veterans in SkillBridge are already job-seeking. We monetize via employer fees, which are tied to a real ROI (the labor shortage costs them money every day the role is open).

**Q: What's your CAC and LTV look like?**
A: Veteran side: near-zero CAC because we're plugged into SkillBridge, Fort Cavazos, and FourBlock as potential supply partners. Employer side: founder-led sales into Texas industrial companies in Q2. CAC will be real but bounded — the market is thousands of employers, not millions. LTV: a paying employer doing 10–20 hires/year at $11–15K placement + subscription is low-six-figures LTV.

### Competition

**Q: Isn't Redeployable doing this in the UK?**
A: Closest analog. Their AI crosswalk is real and impressive. Two differences: (1) they're not deep in US blue-collar industrial verticals — we're Texas oil & gas, construction, logistics from day one; (2) their Job Drop simulation is a pre-hire try-before-you-apply layer; our funnel is post-application placement management. Different part of the pipeline.

**Q: FourBlock says they do this too.**
A: FourBlock is the best classroom layer in the industry — 35-veteran cohorts, 12 sites, Colonel Abrams has 11 weeks of structured content. Their gap is placement. No employer relationships, no ROI loop, no monetization of alumni. We're talking to them about being a supply partner, not a competitor.

**Q: What stops NOV from just going direct? They know their hiring needs.**
A: NOV's existing SkillBridge program has the placement gap Ryan confirmed on March 30 — veterans "complete the program, then fall off a cliff." Building internal AI matching, running the pipeline, owning the funnel UI — that's a 12-month project for them. We're a platform they plug into. Same reason Fortune 500s use LinkedIn Recruiter instead of building their own sourcing tool.

### Defensibility / moat

**Q: What's your defensible moat? AI matching is table stakes.**
A: Three compounding effects. (1) Crosswalk data — every DD-214 we process makes the matching engine smarter. (2) Two-sided network effects — every veteran makes the platform more valuable to employers, and vice versa. (3) WOTC automation + Texas regulatory familiarity — the unsexy compliance layer that takes time to build and is sticky once it's there. None of these are moats on day one. They become moats by year two if we stay focused on the beachhead.

**Q: What if Indeed or LinkedIn adds a "Veteran" badge?**
A: They already did. It's a checkbox. Our advantage isn't branding — it's the translation engine. Indeed's veteran pipeline returns veterans who search for "logistics coordinator." Our pipeline returns veterans whose MOS maps to logistics coordinator even if they've never heard of the title. That's a different product.

### Technology

**Q: What happens if Anthropic goes down?**
A: Two paths degrade gracefully. The DD-214 upload path returns a 503 and the veteran falls back to manual MOS entry — the rest of the profile flow works. The LinkedIn import returns a 503 and the employer falls back to typing it in. Neither path takes down the core matching engine, which runs on our own Postgres — no AI dependency at match time.

**Q: How do you handle privacy?**
A: DD-214 uploads are processed in memory, never stored. Veteran profiles are only visible to employers they're matched to. No data brokering, no selling to third parties. Activity logging captures actions (for admin observability) but never the pasted text content.

### Traction / metrics

**Q: How many veterans have signed up?**
A: We're pre-cohort. The product is live, the infrastructure is live, we've seeded Texas employers from the beachhead analysis. Q2 target is the first 30 veterans — one Fort Cavazos cohort — running end-to-end through the pipeline.

**Q: What's your biggest risk?**
A: Two-sided cold-start. We need enough veterans for employers to take us seriously, and enough employers for veterans to see real matches. Our Q2 plan solves that by pre-committing two employers (NOV, GE Vernova) before we recruit the first cohort — so when the first veterans land, there's a real pipeline on the other side.

---

## Backup Plans

### If the site is slow / down mid-demo
- Pause the script, say *"let me show you what this looks like from the previous demo"*, and switch to the screenshots in `/tmp/`:
  - `/tmp/emp-detail.png` — employer listing detail + funnel
  - `/tmp/li-profile-imported.png` — LinkedIn import success state
  - `/tmp/prod-faq.png` — landing page with FAQ
- Keep narrating. Don't apologize — product confidence matters more than perfect uptime in a 12-minute window.

### If a Claude extraction fails
- It happens. Say *"AI extraction is a best-effort layer — here's the manual path"* and click through the manual entry flow. Reinforces that the AI is value-add, not a single point of failure.

### If someone challenges the WOTC math
- "$2,400 is the baseline for any veteran. Goes up to $9,600 for service-disabled veterans hired within one year of separation, or disabled veterans with extended unemployment. Our beachhead cohort overlaps the higher brackets — many Fort Cavazos separatees qualify. The paperwork is the value-add on our side; we facilitate the claim."

### If you run long
- Cut: the edit listing screen (9:15 block), save 45 seconds.
- Cut: the LinkedIn import demo if you've already shown DD-214 extraction — both AI moments make the same point.

### If you have extra time
- Show the admin dashboard at `/admin/dashboard` — operational visibility, activity logs, cohort stats. Reinforces "we built an actual platform, not a landing page."
- Show the mobile responsive view of the landing page — veterans often browse on phones.

---

## One-Slide Summary (to show if asked)

| What it is | Two-sided workforce platform: military → industrial |
| --- | --- |
| **Beachhead** | Fort Cavazos veterans → Texas industrial employers (NOV, GE Vernova, KBR) |
| **Revenue** | Employer subscription + per-hire placement fee (offset by WOTC) |
| **Moat** | End-to-end coverage + task-level AI matching + two-sided data flywheel |
| **Stage** | Product live, pre-cohort, Q2 target: first 30 veterans through the pipeline |
| **Ask** | Employer pilots and SkillBridge partners in Texas industrial |
