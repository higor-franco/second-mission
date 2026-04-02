import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface Application {
  id: number
  status: string
  match_score: number
  notes: string
  job_listing_id: number
  title: string
  description: string
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  wotc_eligible: boolean
  sector: string
  role_title: string
  company_name: string
}

interface StatusCounts {
  matched?: number
  interested?: number
  introduced?: number
  interviewing?: number
  placed?: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; description: string; step: number }> = {
  matched: {
    label: 'MATCHED',
    color: 'text-gray-600',
    bg: 'bg-gray-100 border-gray-300',
    description: 'Platform identified this as a strong fit for your MOS',
    step: 1,
  },
  interested: {
    label: 'INTERESTED',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-300',
    description: 'You expressed interest — Second Mission notified',
    step: 2,
  },
  introduced: {
    label: 'INTRODUCED',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-300',
    description: 'Second Mission made the introduction to the employer',
    step: 3,
  },
  interviewing: {
    label: 'INTERVIEWING',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-300',
    description: 'Interview scheduled or in progress',
    step: 4,
  },
  placed: {
    label: 'PLACED ✓',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-300',
    description: 'Successfully hired — mission accomplished',
    step: 5,
  },
}

const PIPELINE_STEPS = ['matched', 'interested', 'introduced', 'interviewing', 'placed']

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

export default function ApplicationsPage() {
  const { veteran, loading } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({})
  const [appsLoading, setAppsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const loadApplications = () => {
    fetch('/api/veteran/applications', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setApplications(data.applications || [])
        setStatusCounts(data.status_counts || {})
      })
      .catch(() => {})
      .finally(() => setAppsLoading(false))
  }

  useEffect(() => {
    if (!veteran) return
    loadApplications()
  }, [veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) return <Navigate to="/login" replace />

  const filtered = activeFilter === 'all'
    ? applications
    : applications.filter(a => a.status === activeFilter)

  const totalActive = (statusCounts.interested || 0) + (statusCounts.introduced || 0) + (statusCounts.interviewing || 0)
  const placed = statusCounts.placed || 0

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
            <Link to="/dashboard" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Dashboard
            </Link>
            <Link to="/opportunities" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Opportunities
            </Link>
            <Link to="/applications" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
              My Pipeline
            </Link>
            <Link to="/profile" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="animate-fade-in-up mb-10">
          <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)]">STEP 04 — PLACE</span>
          <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mt-1">
            YOUR CAREER PIPELINE
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Track your progress from match to placement.
            {totalActive > 0 && ` You have ${totalActive} active application${totalActive > 1 ? 's' : ''} in progress.`}
            {placed > 0 && ` 🎉 ${placed} placement${placed > 1 ? 's' : ''} secured.`}
          </p>
        </div>

        {/* Pipeline funnel */}
        <div className="animate-fade-in-up grid grid-cols-5 gap-2 mb-10" style={{ animationDelay: '0.1s' }}>
          {PIPELINE_STEPS.map((step, i) => {
            const cfg = STATUS_CONFIG[step]
            const count = statusCounts[step as keyof StatusCounts] || 0
            const isActive = count > 0
            return (
              <button
                key={step}
                onClick={() => setActiveFilter(activeFilter === step ? 'all' : step)}
                className={`relative p-4 rounded-sm border-2 text-center transition-all cursor-pointer ${
                  activeFilter === step
                    ? 'border-[var(--navy)] bg-[var(--navy)] text-white shadow-lg scale-[1.02]'
                    : isActive
                      ? 'border-[var(--gold)] bg-white hover:shadow-md'
                      : 'border-[var(--sand-dark)] bg-white opacity-50'
                }`}
              >
                {/* Step number */}
                <div className={`font-heading text-3xl md:text-4xl ${
                  activeFilter === step ? 'text-[var(--gold)]' : isActive ? 'text-[var(--navy)]' : 'text-[var(--muted-foreground)]'
                }`}>
                  {count}
                </div>
                <div className={`font-heading text-xs tracking-wider mt-1 ${
                  activeFilter === step ? 'text-[var(--sand)]' : 'text-[var(--navy)]'
                }`}>
                  {cfg.label}
                </div>
                {/* Connector arrow */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="hidden md:block absolute -right-[9px] top-1/2 -translate-y-1/2 z-10 text-[var(--sand-dark)] text-lg">
                    ›
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Filter bar */}
        <div className="animate-fade-in-up flex items-center gap-3 mb-6" style={{ animationDelay: '0.15s' }}>
          <span className="text-sm text-[var(--muted-foreground)]">Showing:</span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-1.5 rounded-sm text-sm font-semibold tracking-wide border transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                : 'bg-white text-[var(--navy)] border-[var(--sand-dark)] hover:border-[var(--navy)]'
            }`}
          >
            ALL ({applications.length})
          </button>
          {PIPELINE_STEPS.filter(s => (statusCounts[s as keyof StatusCounts] || 0) > 0).map(step => {
            const cfg = STATUS_CONFIG[step]
            return (
              <button
                key={step}
                onClick={() => setActiveFilter(step)}
                className={`px-4 py-1.5 rounded-sm text-sm font-semibold tracking-wide border transition-all cursor-pointer ${
                  activeFilter === step
                    ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                    : 'bg-white text-[var(--navy)] border-[var(--sand-dark)] hover:border-[var(--navy)]'
                }`}
              >
                {cfg.label} ({statusCounts[step as keyof StatusCounts] || 0})
              </button>
            )
          })}
        </div>

        {/* Applications list */}
        {appsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-16 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="font-heading text-2xl text-[var(--navy)] tracking-wide mb-3">
              {applications.length === 0 ? 'NO APPLICATIONS YET' : 'NOTHING IN THIS STATUS'}
            </h3>
            <p className="text-[var(--muted-foreground)] max-w-md mx-auto mb-6">
              {applications.length === 0
                ? 'Visit the Opportunities page to find matched jobs and express interest.'
                : 'Try a different filter above.'}
            </p>
            {applications.length === 0 && (
              <Link
                to="/opportunities"
                className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-all no-underline cursor-pointer"
              >
                Browse Matched Opportunities →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app, i) => {
              const cfg = STATUS_CONFIG[app.status]
              const currentStep = cfg.step
              return (
                <div
                  key={app.id}
                  className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-6 hover:shadow-md transition-all"
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Status badge */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                      <span className={`text-xs font-bold tracking-wider px-3 py-1 rounded-sm border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {/* Mini pipeline dots */}
                      <div className="flex gap-1 mt-2">
                        {PIPELINE_STEPS.map((_, idx) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full ${
                              idx + 1 <= currentStep ? 'bg-[var(--gold)]' : 'bg-[var(--sand-dark)]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-heading text-xl tracking-wider text-[var(--navy)]">
                            {app.title}
                          </h3>
                          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                            <span className="font-semibold text-[var(--navy-light)]">{app.company_name}</span>
                            {' · '}
                            {app.location}
                            {' · '}
                            <span className="text-xs font-semibold text-[var(--gold-dark)]">{app.sector}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-heading text-lg text-[var(--navy)]">
                            {formatSalary(app.salary_min)} – {formatSalary(app.salary_max)}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">Match: {app.match_score}%</div>
                        </div>
                      </div>

                      <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed line-clamp-2">
                        {app.description}
                      </p>

                      {/* Status description */}
                      <p className="text-xs text-[var(--muted-foreground)] mt-3 italic border-l-2 border-[var(--gold)] pl-3">
                        {cfg.description}
                      </p>

                      {/* WOTC */}
                      {app.wotc_eligible && (
                        <span className="inline-block mt-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm">
                          WOTC ELIGIBLE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA to browse more */}
        {!appsLoading && applications.length > 0 && (
          <div className="animate-fade-in-up mt-10 text-center" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 border-2 border-[var(--navy)] text-[var(--navy)] font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy)] hover:text-white transition-all no-underline cursor-pointer"
            >
              Browse More Opportunities →
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
