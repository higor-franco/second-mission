import { useState, useEffect } from 'react'
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

export default function ProfilePage() {
  const { veteran, loading, logout, refresh } = useAuth()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [mosCode, setMosCode] = useState('')
  const [rank, setRank] = useState('')
  const [yearsOfService, setYearsOfService] = useState('')
  const [separationDate, setSeparationDate] = useState('')
  const [location, setLocation] = useState('')
  const [preferredSectors, setPreferredSectors] = useState<string[]>([])

  // Populate form when veteran data loads
  useEffect(() => {
    if (veteran) {
      setName(veteran.name || '')
      setMosCode(veteran.mos_code || '')
      setRank(veteran.rank || '')
      setYearsOfService(veteran.years_of_service ? String(veteran.years_of_service) : '')
      setSeparationDate(veteran.separation_date || '')
      setLocation(veteran.location || '')
      setPreferredSectors(veteran.preferred_sectors || [])
    }
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
            <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10L9 14L15 6" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
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

          <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mt-6 mb-2">
            YOUR PROFILE
          </h1>
          <p className="text-[var(--muted-foreground)] mb-10">
            Complete your profile to get personalized career matches. The more we know about your service, the better we can translate your skills.
          </p>

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
        </div>
      </main>
    </div>
  )
}
