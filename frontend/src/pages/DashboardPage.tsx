import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface MatchedRole {
  onet_code: string
  title: string
  description: string
  sector: string
  salary_min: number
  salary_max: number
  match_score: number
  transferable_skills: string[]
}

interface JourneyData {
  journey_step: string
  has_mos: boolean
  has_profile: boolean
  total_matches: number
  status_counts: Record<string, number>
}

const JOURNEY_STEPS = [
  {
    id: 'discover',
    number: '01',
    title: 'DISCOVER',
    description: 'Learn what industrial careers pay and look like',
    action: null,
    actionLabel: null,
  },
  {
    id: 'translate',
    number: '02',
    title: 'TRANSLATE',
    description: 'Map your MOS to civilian job tasks',
    action: '/translate',
    actionLabel: 'Try the Translator',
  },
  {
    id: 'match',
    number: '03',
    title: 'MATCH',
    description: 'Browse real jobs from Texas employers',
    action: '/opportunities',
    actionLabel: 'View Opportunities',
  },
  {
    id: 'place',
    number: '04',
    title: 'PLACE',
    description: 'Track your progress toward a placement',
    action: '/applications',
    actionLabel: 'View Pipeline',
  },
]

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

export default function DashboardPage() {
  const { veteran, loading, logout } = useAuth()
  const [roles, setRoles] = useState<MatchedRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null)

  useEffect(() => {
    if (!veteran) return

    fetch('/api/veteran/matches', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setRoles(data.roles || []))
      .catch(() => {})
      .finally(() => setRolesLoading(false))

    fetch('/api/veteran/journey', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setJourneyData(data))
      .catch(() => {})
  }, [veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) return <Navigate to="/login" replace />

  const currentStep = journeyData?.journey_step || veteran.journey_step || 'discover'
  const currentStepIndex = JOURNEY_STEPS.findIndex(s => s.id === currentStep)
  const activeApplications = journeyData
    ? (journeyData.status_counts.interested || 0) +
      (journeyData.status_counts.introduced || 0) +
      (journeyData.status_counts.interviewing || 0)
    : 0
  const placed = journeyData?.status_counts.placed || 0

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Header */}
      <header className="bg-[var(--navy)] text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto brightness-0 invert" />
            <span className="font-heading text-2xl tracking-wider text-white leading-none hidden sm:block">
              SECOND MISSION
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
              Dashboard
            </Link>
            <Link to="/opportunities" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Opportunities
            </Link>
            <Link to="/applications" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              My Pipeline
            </Link>
            <Link to="/profile" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Profile
            </Link>
            <button
              onClick={logout}
              className="text-sm font-medium text-[var(--sand-dark)] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="animate-fade-in-up mb-10">
          <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide">
            {veteran.name ? `WELCOME BACK, ${veteran.name.split(' ')[0].toUpperCase()}` : 'WELCOME, VETERAN'}
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            {veteran.email}
            {veteran.mos_code && (
              <span className="ml-3 inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm">
                MOS: {veteran.mos_code}
              </span>
            )}
          </p>
        </div>

        {/* Profile completion banner */}
        {!veteran.profile_complete && (
          <div className="animate-fade-in-up bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-sm p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ animationDelay: '0.05s' }}>
            <div>
              <h3 className="font-heading text-xl tracking-wider text-[var(--navy)]">COMPLETE YOUR PROFILE</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Add your MOS code to instantly unlock matched job opportunities from Texas employers.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold px-6 py-3 rounded-sm hover:bg-[var(--gold-light)] transition-all cursor-pointer no-underline text-sm whitespace-nowrap"
            >
              Add Your MOS Code →
            </Link>
          </div>
        )}

        {/* Journey Progress */}
        <div className="animate-fade-in-up mb-10" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">YOUR JOURNEY</h2>
            <span className="text-sm text-[var(--muted-foreground)]">
              Step {currentStepIndex + 1} of 4
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {JOURNEY_STEPS.map((step, i) => {
              const isComplete = i < currentStepIndex
              const isCurrent = i === currentStepIndex
              const isLocked = i > currentStepIndex + 1

              return (
                <div
                  key={step.id}
                  className={`relative p-5 rounded-sm border-2 transition-all ${
                    isCurrent
                      ? 'border-[var(--gold)] bg-white shadow-md'
                      : isComplete
                        ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                        : isLocked
                          ? 'border-[var(--sand-dark)] bg-white opacity-40'
                          : 'border-[var(--sand-dark)] bg-white hover:border-[var(--navy)] hover:shadow-sm'
                  }`}
                >
                  {/* Step number */}
                  <div className={`font-heading text-4xl leading-none mb-2 ${
                    isCurrent ? 'text-[var(--gold)]' : isComplete ? 'text-white/30' : 'text-[var(--sand-dark)]'
                  }`}>
                    {step.number}
                  </div>

                  {/* Check mark for complete */}
                  {isComplete && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-[var(--gold)] rounded-full flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}

                  {/* Current indicator */}
                  {isCurrent && (
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <span className="w-2 h-2 bg-[var(--gold)] rounded-full animate-pulse" />
                    </div>
                  )}

                  <h3 className={`font-heading text-lg tracking-wider ${
                    isCurrent ? 'text-[var(--navy)]' : isComplete ? 'text-white' : 'text-[var(--navy)]'
                  }`}>
                    {step.title}
                  </h3>

                  <p className={`text-xs mt-1 leading-snug ${
                    isCurrent ? 'text-[var(--muted-foreground)]' : isComplete ? 'text-white/70' : 'text-[var(--muted-foreground)]'
                  }`}>
                    {step.description}
                  </p>

                  {/* Action link for current step */}
                  {isCurrent && step.action && (
                    <Link
                      to={step.action}
                      className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--gold-dark)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
                    >
                      {step.actionLabel} →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats row */}
        <div className="animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" style={{ animationDelay: '0.15s' }}>
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
            <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">CAREER MATCHES</div>
            <div className="font-heading text-4xl text-[var(--navy)]">{roles.length}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">from your MOS</div>
          </div>
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
            <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">AVG MATCH SCORE</div>
            <div className="font-heading text-4xl text-[var(--gold)]">
              {roles.length > 0
                ? Math.round(roles.reduce((s, r) => s + r.match_score, 0) / roles.length) + '%'
                : '—'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">confidence level</div>
          </div>
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
            <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">ACTIVE APPLICATIONS</div>
            <div className="font-heading text-4xl text-[var(--navy)]">{activeApplications}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">in pipeline</div>
          </div>
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
            <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">PLACEMENTS</div>
            <div className={`font-heading text-4xl ${placed > 0 ? 'text-green-600' : 'text-[var(--navy)]'}`}>
              {placed > 0 ? placed : '—'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">{placed > 0 ? 'jobs secured' : 'mission pending'}</div>
          </div>
        </div>

        {/* Two column layout: opportunities preview + career roles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opportunities CTA */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">MATCHED JOBS</h2>
              <Link
                to="/opportunities"
                className="text-sm font-semibold text-[var(--gold-dark)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
              >
                View All →
              </Link>
            </div>

            {!veteran.mos_code ? (
              <div className="bg-white border-2 border-dashed border-[var(--sand-dark)] rounded-sm p-8 text-center">
                <div className="font-heading text-3xl text-[var(--sand-dark)] mb-2">NO MOS SET</div>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">Set your MOS code to unlock matched job listings from Texas employers.</p>
                <Link to="/profile" className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] no-underline cursor-pointer">
                  Update Profile →
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm overflow-hidden hover:border-[var(--gold)] hover:shadow-md transition-all group">
                <Link to="/opportunities" className="block p-6 no-underline cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-heading text-5xl text-[var(--navy)] group-hover:text-[var(--gold)] transition-colors">
                      {journeyData?.total_matches || 0}
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                      <path d="M5 12H19M13 6L19 12L13 18" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="font-heading text-xl tracking-wider text-[var(--navy)]">MATCHED OPPORTUNITIES</div>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    Real job listings from Texas employers matched to your MOS {veteran.mos_code}.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold-dark)] group-hover:text-[var(--navy)] transition-colors">
                    Browse All Jobs →
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Applications pipeline preview */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">PIPELINE STATUS</h2>
              <Link
                to="/applications"
                className="text-sm font-semibold text-[var(--gold-dark)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
              >
                View All →
              </Link>
            </div>

            {activeApplications === 0 && placed === 0 ? (
              <div className="bg-white border-2 border-dashed border-[var(--sand-dark)] rounded-sm p-8 text-center">
                <div className="font-heading text-3xl text-[var(--sand-dark)] mb-2">PIPELINE EMPTY</div>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  Express interest in job opportunities to start building your placement pipeline.
                </p>
                <Link to="/opportunities" className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] no-underline cursor-pointer">
                  Find Opportunities →
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-6">
                <div className="space-y-3">
                  {[
                    { status: 'interested', label: 'Interested', icon: '📩' },
                    { status: 'introduced', label: 'Introduced', icon: '🤝' },
                    { status: 'interviewing', label: 'Interviewing', icon: '💬' },
                    { status: 'placed', label: 'Placed', icon: '🎉' },
                  ].map(({ status, label, icon }) => {
                    const count = journeyData?.status_counts[status] || 0
                    if (count === 0) return null
                    return (
                      <Link
                        key={status}
                        to="/applications"
                        className="flex items-center justify-between p-3 rounded-sm hover:bg-[var(--cream)] transition-colors no-underline cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{icon}</span>
                          <span className="font-semibold text-sm text-[var(--navy)] tracking-wider">{label.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-2xl text-[var(--navy)]">{count}</span>
                          <span className="text-[var(--muted-foreground)] group-hover:text-[var(--navy)] transition-colors text-sm">→</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Career roles (MOS translation results) */}
        {roles.length > 0 && (
          <div className="animate-fade-in-up mt-10" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">YOUR CAREER TRANSLATIONS</h2>
              <span className="text-sm text-[var(--muted-foreground)]">
                MOS <strong className="text-[var(--navy)]">{veteran.mos_code}</strong> → {roles.length} civilian roles
              </span>
            </div>

            {rolesLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.slice(0, 4).map((role, i) => (
                  <div
                    key={role.onet_code}
                    className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-5 hover:border-[var(--gold)] hover:shadow-sm transition-all"
                    style={{ animationDelay: `${0.04 * i}s` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm">
                          {role.sector.toUpperCase()}
                        </span>
                        <h3 className="font-heading text-lg tracking-wider text-[var(--navy)] mt-1.5">{role.title}</h3>
                      </div>
                      <div className="relative w-12 h-12 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-dark)" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.5" fill="none"
                            stroke={role.match_score >= 85 ? 'var(--gold)' : 'var(--navy)'}
                            strokeWidth="3"
                            strokeDasharray={`${(role.match_score / 100) * 97.4} 97.4`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--navy)]">
                          {role.match_score}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-base text-[var(--navy)]">
                        {formatSalary(role.salary_min)} – {formatSalary(role.salary_max)}
                      </span>
                    </div>
                    {role.transferable_skills.slice(0, 3).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.transferable_skills.slice(0, 3).map(skill => (
                          <span key={skill} className="text-xs bg-[var(--sand)] text-[var(--navy)] px-2 py-0.5 rounded-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {roles.length > 4 && (
              <div className="mt-4 text-center">
                <Link
                  to="/translate"
                  className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
                >
                  See all {roles.length} career translations →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
