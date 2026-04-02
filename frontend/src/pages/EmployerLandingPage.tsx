import { Link } from 'react-router-dom'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const benefits = [
  {
    number: '01',
    title: 'PRE-QUALIFIED PIPELINE',
    description: 'Access a curated pool of veterans whose military skills have been AI-translated into civilian task equivalents. No more guessing if a candidate can do the job.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="8" width="24" height="16" rx="2" /><path d="M4 14h24" /><circle cx="10" cy="20" r="2" /><circle cx="16" cy="20" r="2" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'TASK-LEVEL MATCHING',
    description: 'We don\'t match on job titles. Our engine maps what veterans actually did — convoy logistics, equipment maintenance, team leadership — to your open roles.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 16L14 22L24 10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'WOTC TAX CREDITS',
    description: 'Every veteran hire can qualify for $2,400–$9,600 in Work Opportunity Tax Credits. We flag eligibility automatically and guide you through the paperwork.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="16" cy="16" r="12" /><path d="M16 10v12M12 14h8M12 18h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '04',
    title: 'REDUCE TIME-TO-HIRE',
    description: 'Veterans come with security clearances, drug tests, leadership training, and proven reliability. Skip months of screening — they\'re already vetted.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="16" cy="16" r="12" /><path d="M16 10v6l4 4" strokeLinecap="round" />
      </svg>
    ),
  },
]

const metrics = [
  { value: '73%', label: 'of veterans are underemployed in year one' },
  { value: '3.5M', label: 'blue-collar roles unfilled annually' },
  { value: '$2.4K+', label: 'avg WOTC tax credit per hire' },
  { value: '$68K+', label: 'avg starting salary, matched roles' },
]

const sectors = [
  'Energy & Oil/Gas',
  'Construction',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Field Operations',
  'Maintenance & Repair',
]

export default function EmployerLandingPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 pattern-stripes opacity-50" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="animate-fade-in-up">
              <span className="inline-block text-xs font-semibold tracking-[0.25em] text-[var(--gold-dark)] bg-[var(--gold)]/10 px-4 py-2 rounded-sm mb-6">
                FOR EMPLOYERS
              </span>
            </div>
            <h1 className="animate-fade-in-up font-heading text-5xl md:text-7xl leading-[0.9] text-[var(--navy)] tracking-wide" style={{ animationDelay: '0.05s' }}>
              FILL YOUR HARDEST
              <br />
              ROLES WITH
              <br />
              <span className="text-[var(--gold)]">PROVEN TALENT</span>
            </h1>
            <p className="animate-fade-in-up text-lg text-[var(--muted-foreground)] mt-6 max-w-xl leading-relaxed" style={{ animationDelay: '0.1s' }}>
              Access a pipeline of pre-qualified military veterans whose operational skills
              have been AI-translated into your industry language. Not a job board — a
              workforce solution.
            </p>
            <div className="animate-fade-in-up flex flex-wrap gap-4 mt-8" style={{ animationDelay: '0.15s' }}>
              <Link
                to="/employer/register"
                className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline text-base"
              >
                Start Hiring Veterans
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link
                to="/employer/login"
                className="inline-flex items-center gap-2 border-2 border-[var(--navy)] text-[var(--navy)] font-semibold px-8 py-4 rounded-sm hover:bg-[var(--navy)] hover:text-white transition-all cursor-pointer no-underline text-base"
              >
                Employer Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics bar */}
      <section className="bg-[var(--navy)] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((m, i) => (
              <div key={i} className="animate-fade-in-up text-center" style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="font-heading text-4xl md:text-5xl text-[var(--gold)] leading-none">{m.value}</div>
                <div className="text-sm text-[var(--sand)] mt-2">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="animate-fade-in-up font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide">
              HOW IT WORKS
            </h2>
            <p className="animate-fade-in-up text-[var(--muted-foreground)] mt-3 max-w-lg mx-auto" style={{ animationDelay: '0.05s' }}>
              From pipeline access to placement — everything you need to hire veteran talent at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div
                key={b.number}
                className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8 hover:border-[var(--gold)] hover:shadow-md transition-all group"
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-[var(--navy)] text-[var(--gold)] rounded-sm flex items-center justify-center group-hover:bg-[var(--gold)] group-hover:text-[var(--navy)] transition-colors">
                    {b.icon}
                  </div>
                  <div>
                    <div className="font-heading text-xs tracking-[0.2em] text-[var(--gold-dark)] mb-1">{b.number}</div>
                    <h3 className="font-heading text-xl tracking-wider text-[var(--navy)] mb-2">{b.title}</h3>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{b.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 bg-[var(--sand)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="animate-fade-in-up font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide leading-[0.95]">
                BUILT FOR
                <br />
                <span className="text-[var(--gold)]">INDUSTRIAL EMPLOYERS</span>
              </h2>
              <p className="animate-fade-in-up text-[var(--muted-foreground)] mt-4 leading-relaxed" style={{ animationDelay: '0.05s' }}>
                Second Mission is designed for the VP of Operations with 50 open roles,
                not the HR department running a diversity initiative. We solve labor shortages
                with workforce supply.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sectors.map((s, i) => (
                <div
                  key={s}
                  className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm px-5 py-4 hover:border-[var(--navy)] transition-colors"
                  style={{ animationDelay: `${0.06 * i}s` }}
                >
                  <span className="text-sm font-semibold text-[var(--navy)] tracking-wide">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Overview */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="animate-fade-in-up font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide">
              SIMPLE PRICING
            </h2>
            <p className="animate-fade-in-up text-[var(--muted-foreground)] mt-3 max-w-md mx-auto" style={{ animationDelay: '0.05s' }}>
              Pay for results, not access. Free for veterans, always.
            </p>
          </div>

          <div className="animate-fade-in-up grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white border-2 border-[var(--navy)] rounded-sm p-8">
              <div className="font-heading text-xs tracking-[0.2em] text-[var(--gold-dark)] mb-2">PIPELINE ACCESS</div>
              <h3 className="font-heading text-2xl tracking-wider text-[var(--navy)] mb-3">SUBSCRIPTION</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                Monthly access to pre-qualified veteran candidates matched to your roles.
                Browse profiles, match scores, and availability dates.
              </p>
              <ul className="mt-4 space-y-2">
                {['Unlimited candidate browsing', 'Match score visibility', 'WOTC eligibility flags', 'Availability tracking'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--navy)]">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--gold)" strokeWidth="2">
                      <path d="M3 7L6 10L11 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--navy)] border-2 border-[var(--navy)] rounded-sm p-8 text-white">
              <div className="font-heading text-xs tracking-[0.2em] text-[var(--gold)] mb-2">PLACEMENT</div>
              <h3 className="font-heading text-2xl tracking-wider text-white mb-3">PER-HIRE FEE</h3>
              <p className="text-sm text-[var(--sand)] leading-relaxed">
                Only pay when you hire. The placement fee is offset by WOTC tax credits
                that we help you claim — most employers net positive.
              </p>
              <ul className="mt-4 space-y-2">
                {['Direct introductions', 'Interview coordination', 'WOTC paperwork guidance', 'First-day handoff support'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--sand)]">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--gold)" strokeWidth="2">
                      <path d="M3 7L6 10L11 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[var(--navy)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="animate-fade-in-up font-heading text-4xl md:text-5xl text-white tracking-wide">
            READY TO BUILD YOUR
            <br />
            <span className="text-[var(--gold)]">VETERAN PIPELINE?</span>
          </h2>
          <p className="animate-fade-in-up text-[var(--sand)] mt-4 max-w-lg mx-auto" style={{ animationDelay: '0.05s' }}>
            Join NOV, GE Vernova, and leading Texas employers who are already sourcing
            pre-qualified veteran talent through Second Mission.
          </p>
          <div className="animate-fade-in-up mt-8" style={{ animationDelay: '0.1s' }}>
            <Link
              to="/employer/register"
              className="inline-flex items-center gap-2 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold px-10 py-4 rounded-sm hover:bg-[var(--gold-light)] transition-all cursor-pointer no-underline text-base"
            >
              Create Employer Account
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
