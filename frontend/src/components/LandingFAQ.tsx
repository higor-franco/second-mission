import { useState } from 'react'

// Audience tag on each FAQ entry so the visitor can see who the answer
// is primarily for without us having to split the section in two.
type Audience = 'VETERAN' | 'EMPLOYER' | 'PLATFORM'

interface FAQ {
  audience: Audience
  question: string
  // `answer` accepts ReactNode so we can bold key numbers (e.g. WOTC
  // dollar range) without committing to rich-text parsing.
  answer: React.ReactNode
}

// Ordered for conversion: the first few addresses the questions a
// first-time visitor asks before clicking "Sign in", then the employer
// funnel, then pipeline transparency — matches the page's flow (veteran
// side → employer side → mission).
const FAQS: FAQ[] = [
  {
    // Lead with the beta note — it's the most load-bearing expectation to
    // set for both sides of the marketplace before anything else gets read.
    audience: 'PLATFORM',
    question: 'Is Second Mission production-ready, or is this a beta?',
    answer: (
      <>
        We're in an <strong>open beta / proof-of-concept</strong> phase
        while we validate the platform end-to-end with our Fort Cavazos
        beachhead cohort and anchor Texas employers. Everything you see
        works — veterans can complete the full journey, employers can
        post listings and advance candidates through the hiring funnel —
        but we're still tuning the product with real users.{' '}
        <strong>
          During this testing period the platform is free for everyone
          — veterans <em>and</em> employers
        </strong>
        . Pricing for employers (subscription + per-hire placement fee)
        kicks in only after we exit beta, and we'll notify every
        registered account well in advance. Veterans are free, always.
      </>
    ),
  },
  {
    audience: 'VETERAN',
    question: 'Is Second Mission really free for veterans?',
    answer: (
      <>
        Yes — and it always will be. Veterans never pay a cent. The
        platform is funded (post-beta) by employer subscriptions and
        per-hire placement fees. We also help those employers claim the{' '}
        <strong>Work Opportunity Tax Credit (WOTC)</strong>, which
        offsets their hiring costs by <strong>$2,400–$9,600</strong>{' '}
        per veteran hired.
      </>
    ),
  },
  {
    audience: 'VETERAN',
    question: "What's different about this vs. a regular job board?",
    answer: (
      <>
        Job boards match titles. We map what you actually{' '}
        <em>did</em> in uniform — convoy logistics, equipment
        maintenance, small-team leadership — to the civilian roles
        that need those exact skills. You see matches you wouldn't
        have searched for, each with a transparent score explaining
        why it fits your service record.
      </>
    ),
  },
  {
    audience: 'VETERAN',
    question: "What if I don't know my MOS code or can't find it in your system?",
    answer: (
      <>
        Two options. You can <strong>upload your DD-214</strong> and
        our AI reads your full service history — every MOS, ASI/SQI,
        school, and decoration — then matches you across all of them
        at once. Or you can enter your primary MOS manually. If a
        specific code isn't in our crosswalk yet, we flag it so our
        team can add it — usually within the week.
      </>
    ),
  },
  {
    audience: 'VETERAN',
    question: 'Is my personal information private?',
    answer: (
      <>
        Your profile is only visible to employers you've been matched
        to, and only the fields relevant to the match — MOS,
        transferable skills, availability, location. DD-214 uploads
        are processed <strong>in memory</strong> and never stored. You
        control which employers can move you forward in their pipeline.
      </>
    ),
  },
  {
    audience: 'PLATFORM',
    question: 'Do I need to be near Fort Cavazos or in Texas?',
    answer: (
      <>
        Not required, but Texas is our <strong>beachhead market</strong>.
        We launched with Fort Cavazos as the feeder base and anchor
        employers like NOV and GE Vernova. If you're a Texas-based
        veteran, you'll see the richest match set today. We expand
        geographically as employer demand grows — new regions are
        opening throughout the year.
      </>
    ),
  },
  {
    audience: 'EMPLOYER',
    question: 'How does pricing work for employers?',
    answer: (
      <>
        <strong>Free during the current beta.</strong> Post listings,
        browse candidates, move hires through the funnel — no card, no
        subscription. When we exit beta, pricing is a single per-hire
        model: <strong>15% of first-year base salary</strong> when a
        veteran you sourced through us accepts an offer, invoiced on
        start date. On a typical <strong>$75,000</strong> placement
        that's about <strong>$11,250</strong>, and the{' '}
        <strong>$2,400–$9,600 WOTC tax credit</strong> we facilitate for
        you offsets most of it — often leaving employers net positive on
        the first hire. No subscription, no monthly retainer. Beta
        participants will get ample notice and early-adopter terms
        before anything turns on.
      </>
    ),
  },
  {
    audience: 'EMPLOYER',
    question: 'How are candidates matched to my open roles?',
    answer: (
      <>
        Our hybrid matching engine scores candidates across five
        dimensions: MOS base match, skill overlap, sector alignment,
        your MOS preferences, and location proximity. Every match
        comes with an <strong>explainable breakdown</strong> — no
        black box — and you can filter by sector or match score from
        the candidate browse page.
      </>
    ),
  },
  {
    audience: 'PLATFORM',
    question: 'How long does placement typically take?',
    answer: (
      <>
        We're still in early cohorts, so averages are moving targets.
        What we can promise is <strong>transparency</strong>: every
        candidate moves through a shared 5-stage pipeline — Match →
        Interview → Proposal → Contract → Hired — and both the
        veteran and employer see the same stage in real time. No
        resume black hole.
      </>
    ),
  },
]

// Audience chip colors — reuses the site palette so the chips feel
// native to the landing page rather than generic pills.
const AUDIENCE_STYLES: Record<Audience, string> = {
  VETERAN:  'bg-[var(--navy)]/10 text-[var(--navy)] border-[var(--navy)]/20',
  EMPLOYER: 'bg-[var(--gold)]/15 text-[var(--gold-dark)] border-[var(--gold)]/30',
  PLATFORM: 'bg-[var(--sand)] text-[var(--navy)] border-[var(--sand-dark)]',
}

export default function LandingFAQ() {
  // Track which item is expanded. null = all collapsed; single index
  // means one is open. Clicking an open item closes it; classic accordion
  // behavior keeps the visible surface area manageable on mobile.
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 bg-[var(--cream)]">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)]">FREQUENTLY ASKED</span>
          <h2 className="font-heading text-5xl md:text-6xl text-[var(--navy)] mt-4 tracking-wide">
            QUESTIONS
          </h2>
          <p className="text-[var(--muted-foreground)] mt-4 max-w-2xl mx-auto">
            Everything you need to know before you sign in — whether
            you're transitioning out of service or looking to hire.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`animate-fade-in-up bg-white border rounded-sm transition-all ${
                  isOpen
                    ? 'border-[var(--gold)] shadow-md'
                    : 'border-[var(--sand-dark)] hover:border-[var(--navy)]'
                }`}
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer bg-transparent border-0"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span className={`inline-block text-[10px] font-semibold tracking-[0.15em] px-2 py-1 rounded-sm border flex-shrink-0 mt-0.5 ${AUDIENCE_STYLES[faq.audience]}`}>
                      {faq.audience}
                    </span>
                    <h3 className="font-heading text-base md:text-lg tracking-wide text-[var(--navy)] leading-tight flex-1">
                      {faq.question}
                    </h3>
                  </div>

                  {/* Chevron — rotates via CSS on open. Small, not the
                     focus of the row. */}
                  <svg
                    width="18" height="18" viewBox="0 0 18 18"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    className={`flex-shrink-0 mt-1 text-[var(--navy)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M4 7L9 12L14 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 -mt-1 animate-fade-in-up">
                    {/* Indent the answer under the question by the width
                       of the chip + gap so it reads as an attached body
                       instead of competing with the question text. */}
                    <div className="pl-[76px] text-sm md:text-[15px] text-[var(--muted-foreground)] leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Closing nudge — gives the visitor somewhere to go if their
           question wasn't in the list. Points back to the top of the
           page rather than dead-ending them. */}
        <div className="text-center mt-12 text-sm text-[var(--muted-foreground)]">
          Still have a question?{' '}
          <a href="#how-it-works" className="font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors no-underline cursor-pointer">
            Start with the four-step journey above
          </a>{' '}
          or sign in and try the tool.
        </div>
      </div>
    </section>
  )
}
