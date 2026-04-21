import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

// Public employer shape returned by GET /api/veteran/employers/:id.
// No email, no contact_name, no password — this is the trimmed view a
// veteran is allowed to see before applying.
interface PublicEmployer {
  id: number
  company_name: string
  sector: string
  location: string
  description: string
  website_url: string
  linkedin_url: string
  company_size: string
  founded_year: number
  is_active: boolean
}

interface CompanyListing {
  id: number
  title: string
  description: string
  requirements: string[]
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  wotc_eligible: boolean
  posted_at: string
  tasks: string[]
  benefits: string[]
  mos_codes_preferred: string[]
  onet_code: string
  role_title: string
  sector: string
}

function formatSalary(n: number) {
  if (!n) return ''
  return '$' + (n / 1000).toFixed(0) + 'K'
}

// ensureHttp tolerates employers who typed "www.example.com" instead of
// the full URL. We only add the scheme if the user's input doesn't already
// have one — never rewrite an existing scheme.
function ensureHttp(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return 'https://' + url
}

// Narrow LinkedIn URLs to the safe hosts. Prevents the company profile
// page from becoming an open redirect for anything an employer pastes
// into the linkedin_url field.
function safeLinkedIn(url: string): string {
  if (!url) return ''
  const normalized = ensureHttp(url)
  try {
    const u = new URL(normalized)
    if (u.hostname === 'linkedin.com' || u.hostname.endsWith('.linkedin.com')) {
      return normalized
    }
  } catch {
    // fall through
  }
  return ''
}

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { veteran, loading } = useAuth()

  const [employer, setEmployer] = useState<PublicEmployer | null>(null)
  const [listings, setListings] = useState<CompanyListing[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!veteran || !id) return
    setFetching(true)
    fetch(`/api/veteran/employers/${id}`, { credentials: 'include' })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error || `Unable to load company (HTTP ${res.status})`)
          setEmployer(null)
          setListings([])
          return
        }
        setEmployer(data.employer)
        setListings(data.listings || [])
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setFetching(false))
  }, [id, veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) return <Navigate to="/login" replace />

  const website = employer ? ensureHttp(employer.website_url) : ''
  const linkedin = employer ? safeLinkedIn(employer.linkedin_url) : ''

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Signed-in navy nav — same shape as Opportunities / Applications */}
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
            <Link to="/translate" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
              Translate
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
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Back link — makes "opened in a new tab from Opportunities"
            flow gracefully too, since Link/history still work. */}
        <div className="mb-6">
          <Link
            to="/opportunities"
            className="text-sm text-[var(--navy)] hover:text-[var(--gold-dark)] no-underline cursor-pointer inline-flex items-center gap-1"
          >
            ← Back to opportunities
          </Link>
        </div>

        {fetching && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!fetching && error && (
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-12 text-center">
            <h2 className="font-heading text-3xl text-[var(--navy)] tracking-wide mb-2">COMPANY UNAVAILABLE</h2>
            <p className="text-[var(--muted-foreground)]">{error}</p>
          </div>
        )}

        {!fetching && !error && employer && (
          <>
            {/* Hero card — name, sector, location, and primary action chips */}
            <section className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8">
              <div className="flex flex-wrap items-start gap-2 mb-3">
                <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 border border-[var(--gold)]/20 px-3 py-1 rounded-sm">
                  {(employer.sector || 'INDUSTRY').toUpperCase()}
                </span>
                {employer.company_size && (
                  <span className="inline-block text-xs font-semibold tracking-wider text-[var(--navy)] bg-[var(--sand)] border border-[var(--sand-dark)] px-3 py-1 rounded-sm">
                    {employer.company_size}
                  </span>
                )}
                {employer.founded_year > 0 && (
                  <span className="inline-block text-xs font-semibold tracking-wider text-[var(--navy)] bg-[var(--sand)] border border-[var(--sand-dark)] px-3 py-1 rounded-sm">
                    Founded {employer.founded_year}
                  </span>
                )}
              </div>

              <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide">
                {employer.company_name}
              </h1>
              {employer.location && (
                <p className="text-[var(--muted-foreground)] mt-2">
                  📍 Headquartered in <strong className="text-[var(--navy)]">{employer.location}</strong>
                </p>
              )}

              {(website || linkedin) && (
                <div className="flex flex-wrap items-center gap-3 mt-5">
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold text-sm px-4 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-all no-underline cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 2L10 18M2 10L18 10M3 6A7 7 0 0017 6M3 14A7 7 0 0117 14" strokeLinecap="round" />
                      </svg>
                      Visit website
                    </a>
                  )}
                  {linkedin && (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border-2 border-[var(--navy)] text-[var(--navy)] font-semibold text-sm px-4 py-2 rounded-sm hover:bg-[var(--navy)] hover:text-white transition-all no-underline cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
            </section>

            {/* About */}
            {employer.description && (
              <section className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8 mt-6" style={{ animationDelay: '0.05s' }}>
                <h2 className="font-heading text-sm tracking-widest text-[var(--gold-dark)] mb-4">
                  ABOUT {employer.company_name.toUpperCase()}
                </h2>
                <p className="text-[var(--navy)] leading-relaxed whitespace-pre-line">
                  {employer.description}
                </p>
              </section>
            )}

            {/* Active roles */}
            <section className="animate-fade-in-up mt-6" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="font-heading text-3xl text-[var(--navy)] tracking-wide">OPEN ROLES</h2>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    Live job listings from this employer
                    {listings.length > 0 && (
                      <> — <strong>{listings.length}</strong> active</>
                    )}.
                  </p>
                </div>
                <Link
                  to="/opportunities"
                  className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] no-underline cursor-pointer whitespace-nowrap"
                >
                  See all opportunities →
                </Link>
              </div>

              {listings.length === 0 ? (
                <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-10 text-center">
                  <p className="text-[var(--muted-foreground)]">
                    No active listings from <strong>{employer.company_name}</strong> right now.
                    Check back soon — or browse <Link to="/opportunities" className="text-[var(--navy)] hover:text-[var(--gold-dark)] font-semibold no-underline cursor-pointer">other opportunities</Link>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((l, i) => (
                    <div
                      key={l.id}
                      className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-5 hover:border-[var(--gold)] hover:shadow-md transition-all"
                      style={{ animationDelay: `${0.04 * i}s` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 border border-[var(--gold)]/20 px-2 py-0.5 rounded-sm">
                              {l.sector.toUpperCase()}
                            </span>
                            {l.wotc_eligible && (
                              <span className="text-xs font-semibold tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm">
                                WOTC ELIGIBLE
                              </span>
                            )}
                            <span className="text-xs text-[var(--muted-foreground)] capitalize">{l.employment_type}</span>
                          </div>
                          <h3 className="font-heading text-lg md:text-xl tracking-wider text-[var(--navy)]">
                            {l.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-[var(--muted-foreground)]">
                            {l.location && <span>📍 {l.location}</span>}
                            {(l.salary_min > 0 || l.salary_max > 0) && (
                              <span className="font-heading text-base text-[var(--navy)]">
                                {formatSalary(l.salary_min)} – {formatSalary(l.salary_max)}
                                <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">/yr</span>
                              </span>
                            )}
                          </div>
                          {l.description && (
                            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mt-2 line-clamp-2">
                              {l.description}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`/opportunities`}
                          className="bg-[var(--navy)] text-white font-semibold text-sm px-4 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-all no-underline cursor-pointer whitespace-nowrap"
                        >
                          See match score →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Footer note — sets expectations about how the match actually
                happens so a veteran on a company page doesn't feel lost. */}
            <div className="mt-8 text-xs text-[var(--muted-foreground)] text-center">
              Company profiles are visible to every signed-in veteran. Your personal profile is only shared with employers you match with.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
