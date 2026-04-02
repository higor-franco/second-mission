import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface Opportunity {
  id: number
  title: string
  description: string
  requirements: string[]
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  wotc_eligible: boolean
  sector: string
  role_title: string
  company_name: string
  company_location: string
  match_score: number
  transferable_skills: string[]
}

const SECTOR_COLORS: Record<string, string> = {
  Energy: 'text-amber-700 bg-amber-50 border-amber-200',
  Logistics: 'text-blue-700 bg-blue-50 border-blue-200',
  Construction: 'text-orange-700 bg-orange-50 border-orange-200',
  Maintenance: 'text-green-700 bg-green-50 border-green-200',
  Manufacturing: 'text-purple-700 bg-purple-50 border-purple-200',
  Safety: 'text-red-700 bg-red-50 border-red-200',
  Healthcare: 'text-pink-700 bg-pink-50 border-pink-200',
  'Supply Chain': 'text-cyan-700 bg-cyan-50 border-cyan-200',
  Management: 'text-indigo-700 bg-indigo-50 border-indigo-200',
}

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

function MatchScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? 'var(--gold)' : score >= 70 ? 'var(--navy)' : 'var(--muted-foreground)'
  const dash = (score / 100) * 97.4
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-dark)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} 97.4`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--navy)] leading-none">
        {score}%
      </span>
    </div>
  )
}

export default function OpportunitiesPage() {
  const { veteran, loading } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [oppsLoading, setOppsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const [expressingInterest, setExpressingInterest] = useState<number | null>(null)
  const [expressed, setExpressed] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    if (!veteran) return
    fetch('/api/veteran/opportunities', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setOpportunities(data.opportunities || [])
      })
      .catch(() => {})
      .finally(() => setOppsLoading(false))
  }, [veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) return <Navigate to="/login" replace />

  const sectors = ['All', ...Array.from(new Set(opportunities.map(o => o.sector)))]
  const filtered = activeFilter === 'All'
    ? opportunities
    : opportunities.filter(o => o.sector === activeFilter)

  const handleExpressInterest = async (id: number) => {
    setExpressingInterest(id)
    try {
      const res = await fetch('/api/veteran/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ job_listing_id: id }),
      })
      if (res.ok) {
        setExpressed(prev => new Set([...prev, id]))
      }
    } catch {
      // silent
    } finally {
      setExpressingInterest(null)
    }
  }

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
            <Link to="/opportunities" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
              Opportunities
            </Link>
            <Link to="/applications" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
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
        <div className="animate-fade-in-up mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold-dark)]">STEP 03 — MATCH</span>
              <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mt-1">
                YOUR MATCHED OPPORTUNITIES
              </h1>
              {veteran.mos_code && (
                <p className="text-[var(--muted-foreground)] mt-2">
                  Based on MOS <strong className="text-[var(--navy)]">{veteran.mos_code}</strong> — {opportunities.length} active jobs from Texas employers
                </p>
              )}
            </div>
            {!veteran.mos_code && (
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold px-6 py-3 rounded-sm hover:bg-[var(--gold-light)] transition-all no-underline cursor-pointer text-sm"
              >
                Add MOS Code to See Matches →
              </Link>
            )}
          </div>
        </div>

        {/* No MOS state */}
        {!veteran.mos_code && !oppsLoading && (
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-16 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="font-heading text-3xl text-[var(--navy)] tracking-wide mb-3">SET YOUR MOS CODE</h2>
            <p className="text-[var(--muted-foreground)] max-w-md mx-auto mb-8">
              Your MOS code is the key. Once set, we instantly match you to open jobs from Texas employers who are actively hiring veterans.
            </p>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all no-underline cursor-pointer"
            >
              Complete Your Profile →
            </Link>
          </div>
        )}

        {/* Loading */}
        {oppsLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Content */}
        {!oppsLoading && veteran.mos_code && (
          <>
            {/* Sector filter tabs */}
            {sectors.length > 1 && (
              <div className="animate-fade-in-up flex flex-wrap gap-2 mb-8" style={{ animationDelay: '0.1s' }}>
                {sectors.map(sector => (
                  <button
                    key={sector}
                    onClick={() => setActiveFilter(sector)}
                    className={`px-4 py-2 rounded-sm text-sm font-semibold tracking-wide transition-all cursor-pointer border ${
                      activeFilter === sector
                        ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                        : 'bg-white text-[var(--navy)] border-[var(--sand-dark)] hover:border-[var(--navy)]'
                    }`}
                  >
                    {sector.toUpperCase()}
                    {sector !== 'All' && (
                      <span className="ml-1.5 opacity-60">
                        {opportunities.filter(o => o.sector === sector).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Job listings */}
            {filtered.length === 0 ? (
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-12 text-center">
                <h3 className="font-heading text-2xl text-[var(--navy)] tracking-wide mb-2">NO MATCHES IN THIS SECTOR</h3>
                <p className="text-[var(--muted-foreground)]">Try a different sector filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((opp, i) => {
                  const sectorColor = SECTOR_COLORS[opp.sector] || 'text-gray-700 bg-gray-50 border-gray-200'
                  const isInterested = expressed.has(opp.id)
                  const isExpanding = expandedId === opp.id
                  return (
                    <div
                      key={opp.id}
                      className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm hover:border-[var(--gold)] hover:shadow-md transition-all"
                      style={{ animationDelay: `${0.05 * i}s` }}
                    >
                      {/* Main row */}
                      <div className="p-6">
                        <div className="flex items-start gap-5">
                          {/* Match score */}
                          <MatchScoreRing score={opp.match_score} />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold tracking-wider px-2.5 py-0.5 rounded-sm border ${sectorColor}`}>
                                {opp.sector.toUpperCase()}
                              </span>
                              {opp.wotc_eligible && (
                                <span className="text-xs font-semibold tracking-wider text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-sm">
                                  WOTC ELIGIBLE
                                </span>
                              )}
                              <span className="text-xs text-[var(--muted-foreground)] capitalize">{opp.employment_type}</span>
                            </div>

                            <h3 className="font-heading text-xl md:text-2xl tracking-wider text-[var(--navy)] mt-1">
                              {opp.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-[var(--muted-foreground)]">
                              <span className="font-semibold text-[var(--navy-light)]">{opp.company_name}</span>
                              <span>📍 {opp.location}</span>
                              <span className="font-heading text-base text-[var(--navy)]">
                                {formatSalary(opp.salary_min)} – {formatSalary(opp.salary_max)}
                                <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">/yr</span>
                              </span>
                            </div>

                            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mt-2 line-clamp-2">
                              {opp.description}
                            </p>

                            {/* Transferable skills */}
                            {opp.transferable_skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {opp.transferable_skills.slice(0, 4).map(skill => (
                                  <span key={skill} className="text-xs bg-[var(--sand)] text-[var(--navy)] px-2 py-0.5 rounded-sm">
                                    {skill}
                                  </span>
                                ))}
                                {opp.transferable_skills.length > 4 && (
                                  <span className="text-xs text-[var(--muted-foreground)] px-1">
                                    +{opp.transferable_skills.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleExpressInterest(opp.id)}
                              disabled={isInterested || expressingInterest === opp.id}
                              className={`px-5 py-2.5 rounded-sm text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                isInterested
                                  ? 'bg-green-600 text-white cursor-default'
                                  : 'bg-[var(--navy)] text-white hover:bg-[var(--navy-light)] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed'
                              }`}
                            >
                              {expressingInterest === opp.id
                                ? 'Sending...'
                                : isInterested
                                  ? '✓ Interested'
                                  : 'Express Interest'}
                            </button>
                            <button
                              onClick={() => setExpandedId(isExpanding ? null : opp.id)}
                              className="px-5 py-2 rounded-sm text-sm font-medium text-[var(--navy)] border border-[var(--sand-dark)] hover:border-[var(--navy)] transition-all cursor-pointer whitespace-nowrap bg-white"
                            >
                              {isExpanding ? 'Less ↑' : 'Details ↓'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanding && (
                        <div className="border-t border-[var(--sand-dark)] px-6 py-5 bg-[var(--cream)]/60">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                              <h4 className="font-heading text-sm tracking-widest text-[var(--gold-dark)] mb-3">FULL DESCRIPTION</h4>
                              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{opp.description}</p>
                            </div>
                            <div>
                              <h4 className="font-heading text-sm tracking-widest text-[var(--gold-dark)] mb-3">REQUIREMENTS</h4>
                              <ul className="space-y-1.5">
                                {opp.requirements.map(req => (
                                  <li key={req} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                                    <span className="text-[var(--gold)] mt-0.5 flex-shrink-0">▸</span>
                                    {req}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {opp.wotc_eligible && (
                            <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-sm">
                              <p className="text-sm text-green-800">
                                <strong>💰 WOTC Tax Credit:</strong> This employer may qualify for a $2,400–$9,600 Work Opportunity Tax Credit by hiring you. Second Mission handles all the paperwork.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
