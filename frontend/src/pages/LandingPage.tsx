import { Link } from 'react-router-dom'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const steps = [
  {
    number: '01',
    title: 'DISCOVER',
    description: 'See what industrial careers pay and what they look like day-to-day. Most veterans have never seen these options.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="14" cy="14" r="10" /><path d="M21 21L28 28" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'TRANSLATE',
    description: 'Your MOS code is mapped to civilian job tasks — not titles. AI shows you roles you never knew existed, with match scores.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 8h12M4 14h8M20 20h8M20 26h12" strokeLinecap="round" />
        <path d="M16 12L20 18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'MATCH',
    description: 'Pre-qualified employers see your civilian-translated skills, match score, and availability. WOTC eligibility flagged automatically.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="12" r="6" /><circle cx="22" cy="12" r="6" /><path d="M16 10v6M13 13h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: '04',
    title: 'PLACE',
    description: 'Direct employer introductions. Interview prep. Smooth first-day handoff. No resume black hole.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 16L13 23L26 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      </svg>
    ),
  },
]

const careers = [
  {
    title: 'Wind Turbine Technician',
    sector: 'Energy',
    salary: '$48K – $82K',
    mos: '91B, 15T',
    description: 'Inspect, diagnose, adjust, or repair wind turbines and their mechanical systems.',
  },
  {
    title: 'Logistics Coordinator',
    sector: 'Logistics',
    salary: '$48K – $78K',
    mos: '88M, 92Y',
    description: 'Coordinate material movement, manage inventory, and supervise warehouse operations.',
  },
  {
    title: 'Construction Manager',
    sector: 'Construction',
    salary: '$72K – $120K',
    mos: '12B',
    description: 'Plan, direct, and coordinate construction projects from concept through completion.',
  },
  {
    title: 'Diesel Engine Specialist',
    sector: 'Maintenance',
    salary: '$42K – $72K',
    mos: '91B',
    description: 'Diagnose, repair, and maintain diesel engines and heavy vehicle systems.',
  },
]

const stats = [
  { value: '73%', label: 'of veterans underemployed in year one' },
  { value: '3.5M', label: 'blue-collar roles unfilled annually' },
  { value: '$68K+', label: 'average starting salary in matched roles' },
  { value: '$2,400', label: 'avg. WOTC tax credit per veteran hire' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 pattern-stripes opacity-60" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[var(--navy)]/5 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 lg:gap-16">
            {/* Logo — bold and visible */}
            <div className="animate-scale-in flex-shrink-0" style={{ animationDelay: '0.1s' }}>
              <img
                src="/logo.png"
                alt="Second Mission"
                className="h-48 md:h-56 lg:h-64 w-auto drop-shadow-lg"
              />
            </div>

            {/* Text content */}
            <div className="max-w-3xl">
              <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                <span className="inline-block font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)] bg-[var(--gold)]/10 px-4 py-2 rounded-sm border border-[var(--gold)]/20 mb-8">
                  FREE FOR ALL VETERANS
                </span>
              </div>

              <h1 className="animate-fade-in-up font-heading text-6xl md:text-8xl lg:text-[6.5rem] leading-[0.9] text-[var(--navy)] tracking-wide mb-8" style={{ animationDelay: '0.2s' }}>
                YOUR MILITARY SKILLS.{' '}
                <span className="text-[var(--gold)]">CIVILIAN CAREERS.</span>
              </h1>

              <p className="animate-fade-in-up text-lg md:text-xl text-[var(--muted-foreground)] leading-relaxed max-w-xl mb-10" style={{ animationDelay: '0.3s' }}>
                You led convoys, maintained fleets, managed supply chains under pressure. Those skills are worth{' '}
                <strong className="text-[var(--navy)]">$68K+ in the civilian market</strong>. We translate what you did into careers you didn't know existed.
              </p>

              <div className="animate-fade-in-up flex flex-col sm:flex-row gap-4" style={{ animationDelay: '0.4s' }}>
                <Link
                  to="/translate"
                  className="inline-flex items-center justify-center gap-3 bg-[var(--navy)] text-white font-semibold text-lg px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all hover:translate-y-[-2px] hover:shadow-lg cursor-pointer no-underline"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 10L9 14L15 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Translate Your MOS
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 border-2 border-[var(--navy)] text-[var(--navy)] font-semibold text-lg px-8 py-4 rounded-sm hover:bg-[var(--navy)] hover:text-white transition-all cursor-pointer no-underline"
                >
                  See How It Works
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[var(--navy)] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center animate-fade-in-up" style={{ animationDelay: `${0.1 * i}s` }}>
                <div className="font-heading text-4xl md:text-5xl text-[var(--gold)] tracking-wide">{stat.value}</div>
                <div className="text-sm text-[var(--sand-dark)] mt-2 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-[var(--cream)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)]">THE PIPELINE</span>
            <h2 className="font-heading text-5xl md:text-6xl text-[var(--navy)] mt-4 tracking-wide">
              FOUR STEPS TO YOUR NEW CAREER
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="animate-fade-in-up group relative bg-white border border-[var(--sand-dark)] p-8 rounded-sm hover:border-[var(--gold)] hover:shadow-lg transition-all cursor-default"
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                <div className="absolute top-4 right-4 font-heading text-5xl text-[var(--sand-dark)] group-hover:text-[var(--gold)]/30 transition-colors">
                  {step.number}
                </div>
                <div className="text-[var(--navy)] group-hover:text-[var(--gold-dark)] transition-colors mb-6">
                  {step.icon}
                </div>
                <h3 className="font-heading text-2xl tracking-wider text-[var(--navy)] mb-3">{step.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Career Cards */}
      <section id="careers" className="py-24 bg-[var(--sand)] pattern-stripes">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)]">REAL OPPORTUNITIES</span>
            <h2 className="font-heading text-5xl md:text-6xl text-[var(--navy)] mt-4 tracking-wide">
              CAREERS WAITING FOR YOU
            </h2>
            <p className="text-[var(--muted-foreground)] mt-4 max-w-2xl mx-auto">
              These aren't hypothetical roles. Texas employers are actively hiring for these positions right now.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {careers.map((career, i) => (
              <div
                key={i}
                className="animate-fade-in-up bg-white border border-[var(--sand-dark)] p-8 rounded-sm hover:border-[var(--gold)] hover:shadow-lg transition-all group"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm">
                      {career.sector.toUpperCase()}
                    </span>
                    <h3 className="font-heading text-2xl tracking-wider text-[var(--navy)] mt-3">{career.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-2xl text-[var(--navy)]">{career.salary}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">annual salary range</div>
                  </div>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-4">{career.description}</p>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="font-semibold text-[var(--navy)]">Common MOS matches:</span>
                  {career.mos}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/translate"
              className="inline-flex items-center gap-3 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold text-lg px-10 py-4 rounded-sm hover:bg-[var(--gold-light)] transition-all hover:translate-y-[-2px] hover:shadow-lg cursor-pointer no-underline"
            >
              Find Your Match — Enter Your MOS
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 10H15M11 6L15 10L11 14" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[var(--navy)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--gold)] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[var(--gold)] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-heading text-5xl md:text-6xl text-white tracking-wide mb-6">
            YOUR SKILLS ARE WORTH MORE THAN YOU THINK
          </h2>
          <p className="text-lg text-[var(--sand-dark)] mb-10 leading-relaxed">
            73% of veterans are underemployed in their first civilian year. Not because they lack skills — because nobody translated them. Until now.
          </p>
          <Link
            to="/translate"
            className="inline-flex items-center gap-3 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold text-lg px-10 py-5 rounded-sm hover:bg-[var(--gold-light)] transition-all hover:translate-y-[-2px] hover:shadow-xl cursor-pointer no-underline"
          >
            Translate Your MOS Now — It's Free
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 10H15M11 6L15 10L11 14" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
