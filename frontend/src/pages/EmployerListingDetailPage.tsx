import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'

// The detail page serves two jobs: show the full listing as the employer
// posted it (so they can sanity-check what veterans see before editing or
// relisting) and show the hiring funnel scoped to this one listing. The
// backend hands both back in a single call so the page renders from one
// network round-trip.

interface Listing {
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
  civilian_role_id: number
}

interface Candidate {
  application_id: number
  status: string
  match_score: number
  applied_at: string
  updated_at: string
  veteran_id: number
  name: string
  mos_code: string
  rank: string
  years_of_service: number
  separation_date: string
  veteran_location: string
  journey_step: string
}

interface DetailResponse {
  listing: Listing
  candidates: Candidate[]
}

// The 5 funnel columns the product asked for. Each bucket maps to one or
// two DB statuses — by grouping at the UI layer we keep the backend
// progression fine-grained (interested vs. introduced still matters for
// veteran-facing messaging) while giving the employer the cleaner view.
type FunnelKey = 'match' | 'interview' | 'proposal' | 'contract' | 'end'

const FUNNEL_COLUMNS: { key: FunnelKey; label: string; statuses: string[]; blurb: string }[] = [
  { key: 'match',     label: 'MATCH',     statuses: ['matched', 'interested'],        blurb: 'Matched or expressed interest' },
  { key: 'interview', label: 'INTERVIEW', statuses: ['introduced', 'interviewing'],   blurb: 'Introduced and in interviews' },
  { key: 'proposal',  label: 'PROPOSAL',  statuses: ['proposal_sent'],                blurb: 'Offer extended' },
  { key: 'contract',  label: 'CONTRACT',  statuses: ['contract_signed'],              blurb: 'Contract signed' },
  { key: 'end',       label: 'END',       statuses: ['placed'],                       blurb: 'Placed (hired)' },
]

// Forward progression across the full 7-state backend pipeline. Each
// candidate card gets a one-click advance to the next stage based on
// where it is today — the UI groups these into 5 buckets but the
// advance action still moves one real step at a time.
const NEXT_STATUS: Record<string, string> = {
  interested:      'introduced',
  introduced:      'interviewing',
  interviewing:    'proposal_sent',
  proposal_sent:   'contract_signed',
  contract_signed: 'placed',
}

const NEXT_STATUS_LABEL: Record<string, string> = {
  interested:      'Introduce',
  introduced:      'Move to Interview',
  interviewing:    'Extend Offer',
  proposal_sent:   'Sign Contract',
  contract_signed: 'Mark Placed',
}

// Human labels for the raw backend statuses — shown as a chip on each
// candidate card so the employer sees the fine-grained state within the
// bucket (e.g., "Interview" column contains both "Introduced" and
// "Interviewing" candidates).
const STATUS_LABEL: Record<string, string> = {
  matched:         'Matched',
  interested:      'Interested',
  introduced:      'Introduced',
  interviewing:    'Interviewing',
  proposal_sent:   'Offer sent',
  contract_signed: 'Contract signed',
  placed:          'Placed',
}

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

export default function EmployerListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { employer, loading } = useEmployerAuth()
  const [data, setData] = useState<DetailResponse | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [togglingActive, setTogglingActive] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    if (!employer || !id) return
    setDataLoading(true)
    fetch(`/api/employer/listings/${id}/candidates`, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed (${res.status})`)
        }
        return res.json()
      })
      .then((payload: DetailResponse) => setData(payload))
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load listing'))
      .finally(() => setDataLoading(false))
  }, [employer, id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employer) return <Navigate to="/employer/login" replace />

  async function handleToggleActive() {
    if (!data) return
    setTogglingActive(true)
    const res = await fetch(`/api/employer/listings/${data.listing.id}/toggle`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      const body = await res.json()
      setData(prev => prev ? { ...prev, listing: { ...prev.listing, is_active: body.is_active } } : prev)
    }
    setTogglingActive(false)
  }

  async function advanceCandidate(applicationId: number, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus]
    if (!next) return
    setUpdatingId(applicationId)
    const res = await fetch(`/api/employer/candidates/${applicationId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setData(prev => prev
        ? {
            ...prev,
            candidates: prev.candidates.map(c =>
              c.application_id === applicationId ? { ...c, status: next } : c,
            ),
          }
        : prev)
    }
    setUpdatingId(null)
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Employer nav header — same pattern as dashboard/profile pages */}
      <header className="bg-[var(--navy)] text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/employer/dashboard" className="flex items-center gap-3 no-underline cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto brightness-0 invert" />
            <span className="font-heading text-2xl tracking-wider text-white leading-none hidden sm:block">
              SECOND MISSION
            </span>
            <span className="text-xs font-semibold tracking-[0.15em] text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm ml-1">
              EMPLOYER
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/employer/dashboard" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Dashboard
            </Link>
            <Link to="/employer/profile" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Company Profile
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link to="/employer/dashboard" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] no-underline cursor-pointer">
            ← Back to Dashboard
          </Link>
        </div>

        {dataLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {loadError && !dataLoading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-sm">
            {loadError}
          </div>
        )}

        {data && !dataLoading && (
          <>
            <ListingHeader
              listing={data.listing}
              togglingActive={togglingActive}
              onToggle={handleToggleActive}
            />

            <ListingDetails listing={data.listing} />

            <FunnelSection
              candidates={data.candidates}
              updatingId={updatingId}
              onAdvance={advanceCandidate}
            />
          </>
        )}
      </main>
    </div>
  )
}

// ---- Sub-components ----

function ListingHeader({
  listing, togglingActive, onToggle,
}: {
  listing: Listing
  togglingActive: boolean
  onToggle: () => void
}) {
  return (
    <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-block w-2 h-2 rounded-full ${listing.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs font-semibold tracking-wider text-[var(--muted-foreground)]">
              {listing.is_active ? 'ACTIVE' : 'PAUSED'}
            </span>
            <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm">
              {listing.sector.toUpperCase()}
            </span>
            {listing.wotc_eligible && (
              <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-sm">
                WOTC
              </span>
            )}
          </div>
          <h1 className="font-heading text-3xl md:text-4xl tracking-wider text-[var(--navy)]">
            {listing.title.toUpperCase()}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-[var(--muted-foreground)] flex-wrap">
            <span>{listing.role_title} ({listing.onet_code})</span>
            <span>·</span>
            <span>{listing.location || '—'}</span>
            <span>·</span>
            <span>{formatSalary(listing.salary_min)} – {formatSalary(listing.salary_max)}</span>
            <span>·</span>
            <span className="capitalize">{listing.employment_type.replace('-', ' ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggle}
            disabled={togglingActive}
            className={`text-sm font-semibold px-4 py-2 rounded-sm transition-colors cursor-pointer border bg-transparent disabled:opacity-50 ${
              listing.is_active
                ? 'border-[var(--sand-dark)] text-[var(--muted-foreground)] hover:border-red-300 hover:text-red-600'
                : 'border-green-300 text-green-700 hover:bg-green-50'
            }`}
          >
            {togglingActive ? '...' : listing.is_active ? 'Pause' : 'Activate & Relist'}
          </button>
          <Link
            to={`/employer/listings/${listing.id}/edit`}
            className="text-sm font-semibold bg-[var(--navy)] text-white px-4 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer no-underline"
          >
            Edit Listing →
          </Link>
        </div>
      </div>
    </div>
  )
}

function ListingDetails({ listing }: { listing: Listing }) {
  const hasTasks = listing.tasks.length > 0
  const hasReqs = listing.requirements.length > 0
  const hasBenefits = listing.benefits.length > 0
  const hasMos = listing.mos_codes_preferred.length > 0

  return (
    <div className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10" style={{ animationDelay: '0.05s' }}>
      <div className="lg:col-span-2 bg-white border border-[var(--sand-dark)] rounded-sm p-6">
        <h2 className="font-heading text-lg tracking-wider text-[var(--navy)] mb-3">DESCRIPTION</h2>
        <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line leading-relaxed">
          {listing.description || 'No description provided.'}
        </p>

        {hasTasks && (
          <div className="mt-6">
            <h2 className="font-heading text-lg tracking-wider text-[var(--navy)] mb-3">KEY TASKS</h2>
            <ul className="space-y-1.5 text-sm text-[var(--muted-foreground)]">
              {listing.tasks.map((task, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--gold)] flex-shrink-0">•</span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {hasReqs && (
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-6">
            <h3 className="font-heading text-base tracking-wider text-[var(--navy)] mb-3">REQUIREMENTS</h3>
            <ul className="space-y-1.5 text-sm text-[var(--muted-foreground)]">
              {listing.requirements.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        )}
        {hasBenefits && (
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-6">
            <h3 className="font-heading text-base tracking-wider text-[var(--navy)] mb-3">BENEFITS</h3>
            <ul className="space-y-1.5 text-sm text-[var(--muted-foreground)]">
              {listing.benefits.map((b, i) => <li key={i}>• {b}</li>)}
            </ul>
          </div>
        )}
        {hasMos && (
          <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-6">
            <h3 className="font-heading text-base tracking-wider text-[var(--navy)] mb-3">PREFERRED MOS</h3>
            <div className="flex flex-wrap gap-2">
              {listing.mos_codes_preferred.map(m => (
                <span key={m} className="text-xs bg-[var(--sand)] text-[var(--navy)] px-2 py-0.5 rounded-sm font-medium">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FunnelSection({
  candidates, updatingId, onAdvance,
}: {
  candidates: Candidate[]
  updatingId: number | null
  onAdvance: (applicationId: number, currentStatus: string) => void
}) {
  const bucketed = FUNNEL_COLUMNS.map(col => ({
    ...col,
    items: candidates.filter(c => col.statuses.includes(c.status)),
  }))
  const total = candidates.length

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl tracking-wider text-[var(--navy)]">HIRING FUNNEL</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {total > 0
              ? `${total} candidate${total === 1 ? '' : 's'} across all stages. Click a card's action to advance to the next stage.`
              : 'No candidates yet. Veterans who express interest in this listing will appear in the Match column.'}
          </p>
        </div>
      </div>

      {/* Horizontally scrollable Kanban. On lg+ screens the five columns
          fit side-by-side; on narrower screens the row scrolls. */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-5 gap-3 min-w-[960px]">
          {bucketed.map(col => (
            <div
              key={col.key}
              className="bg-[var(--sand)]/40 border border-[var(--sand-dark)] rounded-sm p-3"
            >
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-heading text-sm tracking-[0.2em] text-[var(--navy)]">{col.label}</h3>
                <span className="font-heading text-xl text-[var(--navy)]">{col.items.length}</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-3 leading-tight">{col.blurb}</p>

              <div className="space-y-2">
                {col.items.length === 0 ? (
                  <div className="text-xs text-[var(--muted-foreground)]/70 italic p-2 border border-dashed border-[var(--sand-dark)] rounded-sm text-center">
                    empty
                  </div>
                ) : (
                  col.items.map(c => (
                    <CandidateCard
                      key={c.application_id}
                      candidate={c}
                      updating={updatingId === c.application_id}
                      onAdvance={() => onAdvance(c.application_id, c.status)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CandidateCard({
  candidate, updating, onAdvance,
}: {
  candidate: Candidate
  updating: boolean
  onAdvance: () => void
}) {
  const nextLabel = NEXT_STATUS_LABEL[candidate.status]
  const canAdvance = Boolean(NEXT_STATUS[candidate.status])

  return (
    <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-3 hover:border-[var(--gold)] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm tracking-wider text-[var(--navy)] truncate">
            {candidate.name || 'Unnamed Veteran'}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex items-center gap-1.5 flex-wrap">
            {candidate.mos_code && <span className="font-medium text-[var(--navy)]">{candidate.mos_code}</span>}
            {candidate.rank && <><span>·</span><span>{candidate.rank}</span></>}
          </div>
        </div>

        {/* Compact match score badge */}
        <div className="relative w-9 h-9 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-dark)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={candidate.match_score >= 85 ? 'var(--gold)' : 'var(--navy)'}
              strokeWidth="3"
              strokeDasharray={`${(candidate.match_score / 100) * 97.4} 97.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--navy)]">
            {candidate.match_score}%
          </span>
        </div>
      </div>

      <div className="text-[10px] font-semibold tracking-wider text-[var(--muted-foreground)] mb-2">
        {STATUS_LABEL[candidate.status]?.toUpperCase() || candidate.status.toUpperCase()}
      </div>

      {canAdvance && (
        <button
          type="button"
          onClick={onAdvance}
          disabled={updating}
          className="w-full text-[11px] font-semibold text-[var(--navy)] bg-[var(--sand)] hover:bg-[var(--gold)]/20 px-2 py-1.5 rounded-sm transition-colors cursor-pointer border-none disabled:opacity-50"
        >
          {updating ? 'Updating...' : `${nextLabel} →`}
        </button>
      )}
      {candidate.status === 'placed' && (
        <div className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-sm text-center">
          Hired ✓
        </div>
      )}
    </div>
  )
}
