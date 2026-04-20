import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

const RANK_OPTIONS = ['E-1', 'E-2', 'E-3', 'E-4', 'E-5', 'E-6', 'E-7', 'E-8', 'E-9']

const SECTOR_OPTIONS = [
  'Energy',
  'Oil & Gas',
  'Construction',
  'Logistics',
  'Manufacturing',
  'Maintenance',
  'Field Operations',
  'Safety & Compliance',
]

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // keep in sync with backend

// Shape returned by POST /api/veteran/dd214/import — the server builds
// profile_suggestion specifically to match the PUT /api/veteran/profile body,
// so we can drop it straight into the form state below.
interface ImportResponse {
  profile: {
    name: string
    separation_date: string
  }
  profile_suggestion: {
    name: string
    mos_code: string
    rank: string
    years_of_service: number
    separation_date: string
    location: string
    preferred_sectors: string[]
  }
  mos_list: Array<{ code: string; found: boolean }>
  roles: Array<{ onet_code: string }>
}

// View phase on this page.
//
// `choose`: first-time veteran. We show the two-card fork (DD-214 vs manual).
// `upload`: they picked DD-214 and we're collecting + analyzing the file.
// `form`:   manual entry, or post-import review-and-save.
type Phase = 'choose' | 'upload' | 'form'

export default function ProfilePage() {
  const { veteran, loading, logout, refresh } = useAuth()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Form state.
  const [name, setName] = useState('')
  const [mosCode, setMosCode] = useState('')
  const [rank, setRank] = useState('')
  const [yearsOfService, setYearsOfService] = useState('')
  const [separationDate, setSeparationDate] = useState('')
  const [location, setLocation] = useState('')
  const [preferredSectors, setPreferredSectors] = useState<string[]>([])

  // Fork phase.
  //
  // Defaults to 'form' so returning veterans (who already have a profile)
  // see their data straight away. The useEffect below promotes an empty
  // profile to the 'choose' fork, and a successful DD-214 import also
  // flips back to 'form' with pre-filled state.
  const [phase, setPhase] = useState<Phase>('form')
  const [importBannerVisible, setImportBannerVisible] = useState(false)
  const [importStats, setImportStats] = useState<{ mosCount: number; roleCount: number } | null>(null)

  // DD-214 upload state.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  // Populate form when veteran data loads. If the veteran is brand new
  // (no name and no MOS), drop into the fork instead of showing an empty
  // form straight up — matches the sign-in UX the product called for.
  useEffect(() => {
    if (!veteran) return

    const isEmptyProfile = !veteran.name && !veteran.mos_code
    setPhase(isEmptyProfile ? 'choose' : 'form')

    setName(veteran.name || '')
    setMosCode(veteran.mos_code || '')
    setRank(veteran.rank || '')
    setYearsOfService(veteran.years_of_service ? String(veteran.years_of_service) : '')
    setSeparationDate(veteran.separation_date || '')
    setLocation(veteran.location || '')
    setPreferredSectors(veteran.preferred_sectors || [])
  }, [veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) {
    return <Navigate to="/login" replace />
  }

  const toggleSector = (sector: string) => {
    setPreferredSectors(prev =>
      prev.includes(sector)
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0] ?? null
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

  async function handleImport() {
    if (!selectedFile) return
    setImporting(true)
    setError('')

    try {
      const form = new FormData()
      form.append('file', selectedFile)
      const res = await fetch('/api/veteran/dd214/import', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Import failed (${res.status})`)
      }
      const data: ImportResponse = await res.json()
      const s = data.profile_suggestion

      // Drop the AI-suggested values into form state. The user will review
      // and click Save — we never auto-commit.
      setName(s.name || '')
      setMosCode((s.mos_code || '').toUpperCase())
      setRank(RANK_OPTIONS.includes(s.rank) ? s.rank : '')
      setYearsOfService(s.years_of_service ? String(s.years_of_service) : '')
      setSeparationDate(s.separation_date || '')
      setLocation(s.location || '')
      setPreferredSectors(s.preferred_sectors || [])

      setImportStats({
        mosCount: data.mos_list.filter(m => m.found).length,
        roleCount: data.roles.length,
      })
      setImportBannerVisible(true)
      setPhase('form')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      const res = await fetch('/api/veteran/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          mos_code: mosCode,
          rank,
          years_of_service: yearsOfService ? parseInt(yearsOfService) : 0,
          separation_date: separationDate || null,
          location,
          preferred_sectors: preferredSectors,
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setImportBannerVisible(false)
        await refresh()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save profile.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Header */}
      <header className="bg-[var(--navy)] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline group cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto brightness-0 invert" />
            <span className="font-heading text-2xl tracking-wider text-white leading-none">
              SECOND MISSION
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer"
            >
              Dashboard
            </Link>
            <button
              onClick={logout}
              className="text-sm font-medium text-[var(--sand-dark)] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="animate-fade-in-up">
          <Link to="/dashboard" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer">
            ← Back to Dashboard
          </Link>

          {phase === 'choose' && <ChoosePhase onUpload={() => setPhase('upload')} onManual={() => setPhase('form')} />}

          {phase === 'upload' && (
            <UploadPhase
              fileInputRef={fileInputRef}
              selectedFile={selectedFile}
              importing={importing}
              error={error}
              onFileChange={handleFileChange}
              onImport={handleImport}
              onBack={() => {
                setError('')
                setSelectedFile(null)
                setPhase('choose')
              }}
            />
          )}

          {phase === 'form' && (
            <>
              <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mt-6 mb-2">
                YOUR PROFILE
              </h1>
              <p className="text-[var(--muted-foreground)] mb-6">
                Complete your profile to get personalized career matches. The more we know about your service, the better we can translate your skills.
              </p>

              {importBannerVisible && importStats && (
                <div className="mb-6 bg-[var(--navy)]/5 border border-[var(--navy)]/20 text-[var(--navy)] px-5 py-4 rounded-sm animate-fade-in-up">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--gold)] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--navy)" strokeWidth="2.5">
                        <path d="M3 7L6 10L11 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Imported from your DD-214</div>
                      <div className="text-sm text-[var(--muted-foreground)] mt-1">
                        We read {importStats.mosCount} recognized MOS {importStats.mosCount === 1 ? 'code' : 'codes'} off your form and matched you to {importStats.roleCount} civilian {importStats.roleCount === 1 ? 'role' : 'roles'}. Review below and hit <strong>Save Profile</strong> when you're ready.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow"
                  />
                </div>

                {/* MOS + Rank row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mos" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                      MOS Code
                    </label>
                    <input
                      id="mos"
                      type="text"
                      value={mosCode}
                      onChange={(e) => setMosCode(e.target.value.toUpperCase())}
                      placeholder="e.g., 88M"
                      className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="rank" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                      Rank
                    </label>
                    <select
                      id="rank"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow cursor-pointer"
                    >
                      <option value="">Select rank</option>
                      {RANK_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Years + Separation Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="years" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                      Years of Service
                    </label>
                    <input
                      id="years"
                      type="number"
                      min="0"
                      max="40"
                      value={yearsOfService}
                      onChange={(e) => setYearsOfService(e.target.value)}
                      placeholder="e.g., 6"
                      className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div>
                    <label htmlFor="sep-date" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                      Separation Date
                    </label>
                    <input
                      id="sep-date"
                      type="date"
                      value={separationDate}
                      onChange={(e) => setSeparationDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow cursor-pointer"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                    Current Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Killeen, TX"
                    className="w-full px-4 py-3 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow"
                  />
                </div>

                {/* Preferred Sectors */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--navy)] mb-3">
                    Preferred Industries
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SECTOR_OPTIONS.map(sector => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => toggleSector(sector)}
                        className={`px-4 py-2 rounded-sm text-sm font-medium transition-all cursor-pointer border ${
                          preferredSectors.includes(sector)
                            ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                            : 'bg-white text-[var(--navy)] border-[var(--sand-dark)] hover:border-[var(--navy)]'
                        }`}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 8L7 11L12 5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Profile saved successfully!
                  </div>
                )}

                {/* Submit */}
                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={saving || !name}
                    className="bg-[var(--navy)] text-white font-semibold text-lg px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ---------- Phase sub-components ----------

function ChoosePhase({ onUpload, onManual }: { onUpload: () => void; onManual: () => void }) {
  return (
    <div className="mt-6">
      <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mb-2">
        LET'S GET YOU SET UP
      </h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        Pick the fastest way to tell us about your service. You can always edit your profile later.
      </p>

      {/* Primary — DD-214 upload */}
      <button
        type="button"
        onClick={onUpload}
        className="w-full text-left bg-[var(--navy)] text-white p-8 rounded-sm hover:bg-[var(--navy-light)] transition-all hover:translate-y-[-2px] hover:shadow-xl cursor-pointer border-0 block"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <span className="inline-block font-heading text-xs tracking-[0.3em] text-[var(--gold)] mb-3">
              RECOMMENDED
            </span>
            <h2 className="font-heading text-2xl md:text-3xl tracking-wide mb-3">
              UPLOAD YOUR DD-214
            </h2>
            <p className="text-[var(--sand-dark)] leading-relaxed mb-4">
              Our AI reads your <strong className="text-white">full military history</strong> — every MOS, every skill identifier, every school. You'll get matched against <strong className="text-[var(--gold)]">more civilian roles</strong> than a single MOS code can surface.
            </p>
            <div className="flex items-center gap-2 text-sm text-[var(--gold)] font-semibold">
              <span>Upload PDF</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 9h9M10 5l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" stroke="var(--gold)" strokeWidth="2">
              <path d="M12 6h12l6 6v22H12z" strokeLinejoin="round" />
              <path d="M24 6v6h6" strokeLinejoin="round" />
              <path d="M20 22v8M16 26l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[var(--sand-dark)]" />
        <span className="text-xs font-semibold tracking-widest text-[var(--muted-foreground)]">OR</span>
        <div className="flex-1 h-px bg-[var(--sand-dark)]" />
      </div>

      {/* Secondary — manual entry */}
      <button
        type="button"
        onClick={onManual}
        className="w-full text-left bg-white border border-[var(--sand-dark)] p-6 rounded-sm hover:border-[var(--navy)] transition-all cursor-pointer block"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-heading text-xl tracking-wide text-[var(--navy)] mb-2">
              ENTER YOUR DETAILS MANUALLY
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              If you know your MOS and would rather type things in, we'll ask the basics and you'll be done in under a minute.
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--navy)" strokeWidth="2" className="flex-shrink-0 mt-1">
            <path d="M6 10h8M10 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
    </div>
  )
}

function UploadPhase({
  fileInputRef,
  selectedFile,
  importing,
  error,
  onFileChange,
  onImport,
  onBack,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  selectedFile: File | null
  importing: boolean
  error: string
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onImport: () => void
  onBack: () => void
}) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer bg-transparent border-none mb-4"
      >
        ← Back
      </button>

      <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mb-2">
        UPLOAD YOUR DD-214
      </h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        We'll read your form with AI and pre-fill the next step. You'll review and confirm everything before saving.
      </p>

      <div className="bg-white border border-[var(--sand-dark)] p-6 rounded-sm">
        <label className="block text-sm font-semibold tracking-wider text-[var(--navy)] mb-2">
          DD FORM 214 (PDF, MAX 10 MB)
        </label>
        <input
          ref={fileInputRef}
          id="dd214-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFileChange}
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

        <p className="mt-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
          Your DD-214 is analyzed in memory and <strong className="text-[var(--navy)]">never stored</strong>. We only keep the extracted military experience fields on your profile.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 mt-5">
          <button
            type="button"
            onClick={onImport}
            disabled={!selectedFile || importing}
            className="bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            {importing ? (
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
                Analyze & pre-fill profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
