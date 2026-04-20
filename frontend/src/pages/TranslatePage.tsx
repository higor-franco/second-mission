import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Footer from '@/components/Footer'

interface MOSCode {
  code: string
  title: string
  branch: string
  description: string
}

interface TranslatedRole {
  onet_code: string
  title: string
  description: string
  sector: string
  salary_min: number
  salary_max: number
  match_score: number
  transferable_skills: string[]
}

interface TranslateResponse {
  mos: MOSCode
  roles: TranslatedRole[]
}

// --- DD-214 upload types ---

interface DD214MOSEntry {
  code: string
  title: string
}

interface DD214Profile {
  name: string
  primary_mos: DD214MOSEntry
  secondary_mos: DD214MOSEntry[]
  additional_skills: string[]
  rank: string
  paygrade: string
  years_of_service: number
  military_education: string[]
  decorations: string[]
  branch: string
  separation_reason: string
}

interface DD214MOSInfo {
  code: string
  title: string
  branch: string
  description: string
  primary: boolean
  found: boolean
}

interface DD214Role extends TranslatedRole {
  best_mos: string
}

interface DD214Response {
  profile: DD214Profile
  mos_list: DD214MOSInfo[]
  roles: DD214Role[]
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // keep in sync with backend

function formatSalary(amount: number): string {
  return `$${Math.round(amount / 1000)}K`
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 80) return 'bg-[var(--gold)]'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-orange-400'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  return 'Moderate Match'
}

type Mode = 'mos' | 'dd214'

export default function TranslatePage() {
  const { veteran, loading: authLoading, logout } = useAuth()
  const [mode, setMode] = useState<Mode>('mos')

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Manual MOS state
  const [mosCodes, setMosCodes] = useState<MOSCode[]>([])
  const [selectedMOS, setSelectedMOS] = useState('')
  const [mosResult, setMOSResult] = useState<TranslateResponse | null>(null)

  // DD-214 state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dd214Result, setDD214Result] = useState<DD214Response | null>(null)

  // Fetch MOS codes only after we know the veteran is authenticated, since
  // the endpoint is gated. Firing the request before auth resolves would
  // either race with the auth check or surface a 401 as a user-visible
  // "Failed to load MOS codes" toast.
  useEffect(() => {
    if (authLoading || !veteran) return

    fetch('/api/mos-codes', { credentials: 'include' })
      .then(res => res.json())
      .then(setMosCodes)
      .catch(() => setError('Failed to load MOS codes'))
  }, [authLoading, veteran])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) return <Navigate to="/login" replace />

  async function handleTranslate() {
    if (!selectedMOS) return
    setLoading(true)
    setError('')
    setMOSResult(null)
    setDD214Result(null)

    try {
      const res = await fetch(`/api/translate?mos=${encodeURIComponent(selectedMOS)}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Translation failed')
      }
      const data: TranslateResponse = await res.json()
      setMOSResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setError('')
    if (!file) {
      setSelectedFile(null)
      return
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload your DD-214 as a PDF.')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File is too large (max 10 MB).')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setLoading(true)
    setError('')
    setMOSResult(null)
    setDD214Result(null)

    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const res = await fetch('/api/dd214/translate', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed (${res.status})`)
      }
      const data: DD214Response = await res.json()
      setDD214Result(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Signed-in veteran nav — matches Dashboard/Opportunities/Applications. */}
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
            <Link to="/translate" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
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
            <button
              onClick={logout}
              className="text-sm font-medium text-[var(--sand-dark)] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      {/* Hero — padding sized for an in-flow (non-fixed) sticky nav, unlike
         the public Header which used fixed positioning and needed pt-32. */}
      <section className="pt-16 pb-16 bg-[var(--navy)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[var(--gold)] rounded-full blur-[150px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block font-heading text-sm tracking-[0.3em] text-[var(--gold)] mb-6">
            SKILLS TRANSLATION ENGINE
          </span>
          <h1 className="font-heading text-5xl md:text-7xl text-white tracking-wide mb-6">
            WHAT'S YOUR MOS WORTH?
          </h1>
          <p className="text-lg text-[var(--sand-dark)] max-w-2xl mx-auto leading-relaxed">
            Enter your Military Occupational Specialty code — or upload your DD Form 214 — and let our AI translate your full military career into civilian opportunities.
          </p>
        </div>
      </section>

      {/* Tab selector + input panel */}
      <section className="relative -mt-8 z-10 max-w-3xl mx-auto px-6">
        <div className="bg-white border border-[var(--sand-dark)] rounded-sm shadow-xl overflow-hidden">
          {/* Tabs */}
          <div role="tablist" aria-label="Translation input" className="flex border-b border-[var(--sand-dark)]">
            <button
              role="tab"
              aria-selected={mode === 'mos'}
              onClick={() => switchMode('mos')}
              className={`flex-1 px-6 py-5 font-heading text-lg md:text-xl tracking-[0.15em] transition-all cursor-pointer ${
                mode === 'mos'
                  ? 'bg-[var(--navy)] text-white shadow-inner'
                  : 'bg-[var(--cream)] text-[var(--navy)] hover:bg-[var(--sand)]'
              }`}
            >
              I KNOW MY MOS
            </button>
            <button
              role="tab"
              aria-selected={mode === 'dd214'}
              onClick={() => switchMode('dd214')}
              className={`flex-1 px-6 py-5 font-heading text-lg md:text-xl tracking-[0.15em] transition-all cursor-pointer ${
                mode === 'dd214'
                  ? 'bg-[var(--navy)] text-white shadow-inner'
                  : 'bg-[var(--cream)] text-[var(--navy)] hover:bg-[var(--sand)]'
              }`}
            >
              UPLOAD MY DD-214
            </button>
          </div>

          <div className="p-6">
            {mode === 'mos' ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="mos-select" className="block text-sm font-semibold tracking-wider text-[var(--navy)] mb-2">
                    SELECT YOUR MOS CODE
                  </label>
                  <select
                    id="mos-select"
                    value={selectedMOS}
                    onChange={(e) => setSelectedMOS(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-[var(--cream)] text-[var(--navy)] font-medium text-lg focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent cursor-pointer"
                  >
                    <option value="">Choose your MOS...</option>
                    {mosCodes.map(mos => (
                      <option key={mos.code} value={mos.code}>
                        {mos.code} — {mos.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleTranslate}
                    disabled={!selectedMOS || loading}
                    className="w-full sm:w-auto bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Translating...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 9L8 13L14 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Translate
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold tracking-wider text-[var(--navy)] mb-2">
                  UPLOAD YOUR DD FORM 214 (PDF, MAX 10 MB)
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      id="dd214-file"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-left px-4 py-3 border border-dashed border-[var(--sand-dark)] rounded-sm bg-[var(--cream)] text-[var(--navy)] hover:border-[var(--navy)] transition-all cursor-pointer"
                    >
                      {selectedFile ? (
                        <span className="flex items-center gap-3">
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 2h7l3 3v11H4z" strokeLinejoin="round" />
                            <path d="M11 2v3h3" strokeLinejoin="round" />
                          </svg>
                          <span className="font-medium truncate">{selectedFile.name}</span>
                          <span className="text-xs text-[var(--muted-foreground)] ml-auto">
                            {(selectedFile.size / 1024).toFixed(0)} KB
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">Choose your DD-214 PDF...</span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || loading}
                      className="w-full sm:w-auto bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 3v12M4 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Analyze with AI
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Your DD-214 is analyzed in memory and <strong>never stored</strong>. We only keep the extracted military experience fields to match you with civilian roles.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="py-16 max-w-6xl mx-auto px-6">
        {mosResult && <ManualMOSResult result={mosResult} />}
        {dd214Result && <DD214Result result={dd214Result} />}

        {!mosResult && !dd214Result && !loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-[var(--sand)] rounded-full mb-6">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--navy)" strokeWidth="1.5">
                <path d="M8 20h10M22 12v16M32 20H22" strokeLinecap="round" />
                <circle cx="20" cy="20" r="16" />
              </svg>
            </div>
            <h3 className="font-heading text-3xl text-[var(--navy)] tracking-wide mb-3">
              {mode === 'mos' ? 'SELECT YOUR MOS CODE ABOVE' : 'UPLOAD YOUR DD-214 ABOVE'}
            </h3>
            <p className="text-[var(--muted-foreground)] max-w-md mx-auto">
              {mode === 'mos'
                ? "Choose your Military Occupational Specialty and we'll show you exactly which civilian careers match your experience."
                : 'Our AI will read your form and surface every civilian career your full military experience unlocks — not just one MOS.'}
            </p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}

// ---------- Result components ----------

function ManualMOSResult({ result }: { result: TranslateResponse }) {
  return (
    <div className="animate-scale-in">
      {/* MOS Summary */}
      <div className="mb-10 p-8 bg-[var(--navy)] rounded-sm text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold)]">YOUR MOS</span>
            <h2 className="font-heading text-4xl md:text-5xl tracking-wide mt-2">
              {result.mos.code} — {result.mos.title.toUpperCase()}
            </h2>
            <p className="text-[var(--sand-dark)] mt-3 max-w-2xl leading-relaxed">
              {result.mos.description}
            </p>
          </div>
          <div className="text-right">
            <div className="font-heading text-5xl text-[var(--gold)]">{result.roles.length}</div>
            <div className="text-sm text-[var(--sand-dark)]">career matches found</div>
          </div>
        </div>
      </div>

      <RoleCards roles={result.roles} />
    </div>
  )
}

function DD214Result({ result }: { result: DD214Response }) {
  const { profile, mos_list, roles } = result
  const anyFound = mos_list.some(m => m.found)

  return (
    <div className="animate-scale-in space-y-10">
      {/* Extracted Profile Header */}
      <div className="p-8 bg-[var(--navy)] rounded-sm text-white">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold)]">EXTRACTED FROM YOUR DD-214</span>
            <h2 className="font-heading text-3xl md:text-4xl tracking-wide mt-2">
              {profile.name
                ? profile.name.toUpperCase()
                : profile.rank
                  ? `${profile.rank.toUpperCase()}${profile.branch ? `, ${profile.branch.toUpperCase()}` : ''}`
                  : 'YOUR MILITARY PROFILE'}
            </h2>
            {/* Subtitle line: rank · branch · years · paygrade — only rendered when we have a name above. */}
            {profile.name && (profile.rank || profile.branch || profile.years_of_service > 0 || profile.paygrade) && (
              <div className="mt-2 text-sm md:text-base text-[var(--sand-dark)]">
                {[
                  profile.rank,
                  profile.branch ? `U.S. ${profile.branch}` : '',
                  profile.years_of_service > 0 ? `${profile.years_of_service} years of service` : '',
                  profile.paygrade,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            {/* Separation reason kept as a secondary fact so the hero doesn't get crowded. */}
            {profile.separation_reason && (
              <div className="mt-3 text-xs text-[var(--sand-dark)]">
                <span className="text-[var(--gold)] font-semibold">Separation:</span> {profile.separation_reason}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-heading text-5xl text-[var(--gold)]">{roles.length}</div>
            <div className="text-sm text-[var(--sand-dark)]">career matches found</div>
          </div>
        </div>

        {/* MOS chips */}
        <div className="mt-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--gold)] mb-2">MILITARY OCCUPATIONAL SPECIALTIES</div>
          <div className="flex flex-wrap gap-2">
            {mos_list.length === 0 && (
              <span className="text-sm text-[var(--sand-dark)]">No MOS codes extracted.</span>
            )}
            {mos_list.map(m => (
              <span
                key={m.code}
                className={`text-xs font-medium px-3 py-1.5 rounded-sm border ${
                  m.primary
                    ? 'bg-[var(--gold)] text-[var(--navy)] border-[var(--gold)]'
                    : 'bg-transparent text-white border-[var(--sand-dark)]'
                }`}
                title={m.found ? m.description : 'Not in our crosswalk yet'}
              >
                {m.primary && <span className="font-bold mr-1">★</span>}
                {m.code}
                {m.title && <span className="opacity-80"> — {m.title}</span>}
                {!m.found && <span className="ml-1 opacity-60">(no mapping)</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Additional skills, education, decorations — compact */}
        <ProfileFactRow label="Additional skills & identifiers" items={profile.additional_skills} />
        <ProfileFactRow label="Military education" items={profile.military_education} />
        <ProfileFactRow label="Decorations & badges" items={profile.decorations} />
      </div>

      {/* Role cards */}
      {roles.length > 0 ? (
        <RoleCards roles={roles} showBestMOS />
      ) : (
        <div className="p-8 bg-white border border-[var(--sand-dark)] rounded-sm text-center">
          <h3 className="font-heading text-2xl text-[var(--navy)] mb-2">
            {anyFound ? 'NO STRONG MATCHES YET' : 'WE DON\u2019T HAVE THESE SPECIALTIES IN THE CROSSWALK YET'}
          </h3>
          <p className="text-[var(--muted-foreground)] max-w-xl mx-auto leading-relaxed">
            We extracted your DD-214 successfully, but couldn\u2019t produce civilian role matches for the MOS codes above. Our team is expanding the crosswalk weekly — check back soon, or register so we can notify you.
          </p>
        </div>
      )}
    </div>
  )
}

function ProfileFactRow({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-5">
      <div className="text-xs font-semibold tracking-wider text-[var(--gold)] mb-2">{label.toUpperCase()}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${label}-${i}`}
            className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-sm border border-white/20"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function RoleCards({
  roles,
  showBestMOS = false,
}: {
  roles: (TranslatedRole | DD214Role)[]
  showBestMOS?: boolean
}) {
  return (
    <div className="space-y-6">
      {roles.map((role, i) => (
        <div
          key={role.onet_code}
          className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8 hover:border-[var(--gold)] hover:shadow-lg transition-all group"
          style={{ animationDelay: `${0.1 * i}s` }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Match Score */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="var(--sand-dark)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="36" fill="none"
                    stroke={role.match_score >= 90 ? '#10b981' : role.match_score >= 80 ? 'var(--gold)' : '#f59e0b'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(role.match_score / 100) * 226} 226`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading text-2xl text-[var(--navy)]">{role.match_score}%</span>
                </div>
              </div>
              <span className={`mt-2 text-xs font-semibold px-2 py-1 rounded-sm text-white ${getScoreColor(role.match_score)}`}>
                {getScoreLabel(role.match_score)}
              </span>
            </div>

            {/* Role Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm mb-2">
                    {role.sector.toUpperCase()}
                  </span>
                  <h3 className="font-heading text-2xl md:text-3xl tracking-wider text-[var(--navy)]">
                    {role.title.toUpperCase()}
                  </h3>
                  {showBestMOS && 'best_mos' in role && (
                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                      Best match via your <strong className="text-[var(--navy)]">{(role as DD214Role).best_mos}</strong> experience
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl text-[var(--navy)]">
                    {formatSalary(role.salary_min)} – {formatSalary(role.salary_max)}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">annual salary range</div>
                </div>
              </div>

              <p className="text-[var(--muted-foreground)] mt-3 leading-relaxed">
                {role.description}
              </p>

              {/* Transferable Skills */}
              <div className="mt-4">
                <span className="text-xs font-semibold tracking-wider text-[var(--navy)] block mb-2">
                  YOUR TRANSFERABLE SKILLS
                </span>
                <div className="flex flex-wrap gap-2">
                  {role.transferable_skills.map(skill => (
                    <span
                      key={skill}
                      className="text-xs bg-[var(--sand)] text-[var(--navy)] px-3 py-1.5 rounded-sm border border-[var(--sand-dark)] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-[var(--muted-foreground)]">
                O*NET Code: {role.onet_code}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
