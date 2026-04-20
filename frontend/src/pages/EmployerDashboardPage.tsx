import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'

interface DashboardStats {
  active_listings: number
  inactive_listings: number
  total_listings: number
  total_candidates: number
}

interface JobListing {
  id: number
  title: string
  description: string
  requirements: string[]
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  wotc_eligible: boolean
  is_active: boolean
  posted_at: string
  tasks: string[]
  benefits: string[]
  mos_codes_preferred: string[]
  onet_code: string
  role_title: string
  sector: string
}

interface Candidate {
  application_id: number
  status: string
  match_score: number
  applied_at: string
  veteran_id: number
  name: string
  mos_code: string
  rank: string
  years_of_service: number
  separation_date: string
  veteran_location: string
  job_listing_id: number
  job_title: string
  sector: string
}

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

function statusColor(status: string) {
  switch (status) {
    case 'interested':      return 'bg-blue-100 text-blue-800'
    case 'introduced':      return 'bg-amber-100 text-amber-800'
    case 'interviewing':    return 'bg-purple-100 text-purple-800'
    case 'proposal_sent':   return 'bg-indigo-100 text-indigo-800'
    case 'contract_signed': return 'bg-teal-100 text-teal-800'
    case 'placed':          return 'bg-green-100 text-green-800'
    default:                return 'bg-gray-100 text-gray-800'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'interested':      return '📩'
    case 'introduced':      return '🤝'
    case 'interviewing':    return '💬'
    case 'proposal_sent':   return '📄'
    case 'contract_signed': return '🖋️'
    case 'placed':          return '🎉'
    default:                return '📋'
  }
}

// Human-friendly label for the new multi-word statuses. The existing ones
// uppercased fine on their own; the compound statuses get a dedicated map
// so the dashboard shows "Offer Sent" instead of "PROPOSAL_SENT".
function statusLabel(status: string) {
  switch (status) {
    case 'proposal_sent':   return 'OFFER SENT'
    case 'contract_signed': return 'CONTRACT SIGNED'
    default:                return status.toUpperCase()
  }
}

export default function EmployerDashboardPage() {
  const { employer, loading, logout } = useEmployerAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [listings, setListings] = useState<JobListing[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    if (!employer) return

    Promise.all([
      fetch('/api/employer/dashboard', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/employer/listings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/employer/candidates', { credentials: 'include' }).then(r => r.json()),
    ]).then(([statsData, listingsData, candidatesData]) => {
      setStats(statsData)
      setListings(listingsData.listings || [])
      setCandidates(candidatesData.candidates || [])
    }).catch(() => {})
      .finally(() => setDataLoading(false))
  }, [employer])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employer) return <Navigate to="/employer/login" replace />

  const toggleListing = async (id: number) => {
    setTogglingId(id)
    const res = await fetch(`/api/employer/listings/${id}/toggle`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      setListings(prev => prev.map(l => l.id === id ? { ...l, is_active: data.is_active } : l))
      setStats(prev => {
        if (!prev) return prev
        const wasActive = listings.find(l => l.id === id)?.is_active
        return {
          ...prev,
          active_listings: wasActive ? prev.active_listings - 1 : prev.active_listings + 1,
          inactive_listings: wasActive ? prev.inactive_listings + 1 : prev.inactive_listings - 1,
        }
      })
    }
    setTogglingId(null)
  }

  const updateCandidateStatus = async (applicationId: number, newStatus: string) => {
    setUpdatingId(applicationId)
    const res = await fetch(`/api/employer/candidates/${applicationId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
      credentials: 'include',
    })
    if (res.ok) {
      setCandidates(prev => prev.map(c =>
        c.application_id === applicationId ? { ...c, status: newStatus } : c
      ))
    }
    setUpdatingId(null)
  }

  // Full forward progression across the 7-state backend pipeline. Two new
  // stages (proposal_sent, contract_signed) sit between interviewing and
  // placed to match the employer funnel (match → interview → proposal →
  // contract → end).
  const nextStatus: Record<string, string> = {
    interested:      'introduced',
    introduced:      'interviewing',
    interviewing:    'proposal_sent',
    proposal_sent:   'contract_signed',
    contract_signed: 'placed',
  }

  const nextStatusLabel: Record<string, string> = {
    interested:      'Introduce',
    introduced:      'Move to Interview',
    interviewing:    'Extend Offer',
    proposal_sent:   'Sign Contract',
    contract_signed: 'Mark Placed',
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
            <span className="text-xs font-semibold tracking-[0.15em] text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm ml-1">
              EMPLOYER
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/employer/dashboard" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
              Dashboard
            </Link>
            <Link to="/employer/profile" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Company Profile
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
            {employer.company_name ? employer.company_name.toUpperCase() : 'EMPLOYER DASHBOARD'}
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            {employer.email}
            {employer.sector && (
              <span className="ml-3 inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm">
                {employer.sector}
              </span>
            )}
            {employer.location && (
              <span className="ml-2 inline-block text-xs text-[var(--muted-foreground)]">
                {employer.location}
              </span>
            )}
          </p>
        </div>

        {/* Stats */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" style={{ animationDelay: '0.05s' }}>
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
                <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">ACTIVE LISTINGS</div>
                <div className="font-heading text-4xl text-[var(--navy)]">{stats?.active_listings ?? 0}</div>
              </div>
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
                <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">TOTAL LISTINGS</div>
                <div className="font-heading text-4xl text-[var(--gold)]">{stats?.total_listings ?? 0}</div>
              </div>
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
                <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">CANDIDATES</div>
                <div className="font-heading text-4xl text-[var(--navy)]">{stats?.total_candidates ?? 0}</div>
              </div>
              <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-5">
                <div className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)] mb-1">PLACEMENTS</div>
                <div className={`font-heading text-4xl ${candidates.filter(c => c.status === 'placed').length > 0 ? 'text-green-600' : 'text-[var(--navy)]'}`}>
                  {candidates.filter(c => c.status === 'placed').length || '—'}
                </div>
              </div>
            </div>

            {/* Two columns: Listings + Candidates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Job Listings */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">JOB LISTINGS</h2>
                  <Link
                    to="/employer/listings/new"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-[var(--navy)] px-4 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-colors no-underline cursor-pointer"
                  >
                    + New Listing
                  </Link>
                </div>

                {listings.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-[var(--sand-dark)] rounded-sm p-8 text-center">
                    <div className="font-heading text-3xl text-[var(--sand-dark)] mb-2">NO LISTINGS YET</div>
                    <p className="text-sm text-[var(--muted-foreground)] mb-4">
                      Post your first job listing to start receiving matched veteran candidates.
                    </p>
                    <Link
                      to="/employer/listings/new"
                      className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] no-underline cursor-pointer"
                    >
                      Create Your First Listing →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {listings.map(listing => (
                      // A parent `<div>` wraps the card so the Pause/Activate
                      // toggle can stay interactive without being nested
                      // inside an `<a>` (which would be invalid HTML and
                      // also swallow its click). Only the content block is
                      // wrapped in the Link.
                      <div
                        key={listing.id}
                        className="bg-white border border-[var(--sand-dark)] rounded-sm p-5 hover:border-[var(--gold)] hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to={`/employer/listings/${listing.id}`}
                            className="flex-1 min-w-0 no-underline cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-block w-2 h-2 rounded-full ${listing.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                              <span className="text-xs font-semibold tracking-wider text-[var(--muted-foreground)]">
                                {listing.is_active ? 'ACTIVE' : 'PAUSED'}
                              </span>
                              {listing.wotc_eligible && (
                                <span className="text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm">
                                  WOTC
                                </span>
                              )}
                            </div>
                            <h3 className="font-heading text-lg tracking-wider text-[var(--navy)] truncate group-hover:text-[var(--gold-dark)] transition-colors">
                              {listing.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                              <span>{listing.sector}</span>
                              <span>·</span>
                              <span>{listing.location}</span>
                              <span>·</span>
                              <span>{formatSalary(listing.salary_min)}–{formatSalary(listing.salary_max)}</span>
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]/80 mt-1 group-hover:text-[var(--navy)] transition-colors">
                              View details & funnel →
                            </div>
                          </Link>
                          <button
                            onClick={() => toggleListing(listing.id)}
                            disabled={togglingId === listing.id}
                            className={`ml-3 self-start text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors cursor-pointer border ${
                              listing.is_active
                                ? 'border-[var(--sand-dark)] text-[var(--muted-foreground)] hover:border-red-300 hover:text-red-600'
                                : 'border-green-300 text-green-700 hover:bg-green-50'
                            } bg-transparent disabled:opacity-50`}
                          >
                            {togglingId === listing.id ? '...' : listing.is_active ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                        {listing.mos_codes_preferred.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {listing.mos_codes_preferred.map(mos => (
                              <span key={mos} className="text-xs bg-[var(--sand)] text-[var(--navy)] px-2 py-0.5 rounded-sm">
                                MOS: {mos}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Candidates */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">CANDIDATES</h2>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {candidates.length} total
                  </span>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-[var(--sand-dark)] rounded-sm p-8 text-center">
                    <div className="font-heading text-3xl text-[var(--sand-dark)] mb-2">NO CANDIDATES YET</div>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Veterans who express interest in your listings will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidates.map(candidate => (
                      <div
                        key={candidate.application_id}
                        className="bg-white border border-[var(--sand-dark)] rounded-sm p-5 hover:border-[var(--gold)] hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-heading text-lg tracking-wider text-[var(--navy)]">
                              {candidate.name || 'Unnamed Veteran'}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                              {candidate.mos_code && <span>MOS: {candidate.mos_code}</span>}
                              {candidate.rank && <><span>·</span><span>{candidate.rank}</span></>}
                              {candidate.veteran_location && <><span>·</span><span>{candidate.veteran_location}</span></>}
                            </div>
                          </div>
                          {/* Match score */}
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-dark)" strokeWidth="3" />
                              <circle cx="18" cy="18" r="15.5" fill="none"
                                stroke={candidate.match_score >= 85 ? 'var(--gold)' : 'var(--navy)'}
                                strokeWidth="3"
                                strokeDasharray={`${(candidate.match_score / 100) * 97.4} 97.4`}
                                strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--navy)]">
                              {candidate.match_score}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm">{statusIcon(candidate.status)}</span>
                          <span className={`text-xs font-semibold tracking-wider px-2 py-0.5 rounded-sm ${statusColor(candidate.status)}`}>
                            {statusLabel(candidate.status)}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            for {candidate.job_title}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                          {candidate.years_of_service > 0 && (
                            <span>{candidate.years_of_service} yrs service</span>
                          )}
                          {candidate.separation_date && (
                            <><span>·</span><span>Available: {candidate.separation_date}</span></>
                          )}
                        </div>

                        {/* Action button */}
                        {nextStatus[candidate.status] && (
                          <button
                            onClick={() => updateCandidateStatus(candidate.application_id, nextStatus[candidate.status])}
                            disabled={updatingId === candidate.application_id}
                            className="mt-3 text-xs font-semibold text-[var(--navy)] bg-[var(--sand)] hover:bg-[var(--gold)]/20 px-4 py-2 rounded-sm transition-colors cursor-pointer border-none disabled:opacity-50"
                          >
                            {updatingId === candidate.application_id ? 'Updating...' : `${nextStatusLabel[candidate.status]} →`}
                          </button>
                        )}
                        {candidate.status === 'placed' && (
                          <div className="mt-3 text-xs font-semibold text-green-700 bg-green-50 px-4 py-2 rounded-sm inline-block">
                            Successfully placed
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
