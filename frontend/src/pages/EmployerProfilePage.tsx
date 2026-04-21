import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'
import LinkedInImportSection, { type LinkedInProfile } from '@/components/LinkedInImportSection'

const SECTORS = [
  'Energy & Oil/Gas',
  'Construction',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Field Operations',
  'Maintenance & Repair',
  'Other',
]

// Company size bands matching LinkedIn's, so an employer copying from their
// LinkedIn page finds a familiar value in the dropdown. Free-form "Other"
// is intentionally not here — if LinkedIn's bands don't fit, the employer
// can leave the field blank and we'll just not render it.
const COMPANY_SIZE_OPTIONS = [
  '1–10 employees',
  '11–50 employees',
  '51–200 employees',
  '201–500 employees',
  '501–1,000 employees',
  '1,001–5,000 employees',
  '5,001–10,000 employees',
  '10,001+ employees',
]

const CURRENT_YEAR = new Date().getFullYear()

export default function EmployerProfilePage() {
  const { employer, loading, logout, updateEmployer } = useEmployerAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // importBanner is set by the LinkedIn import handler; it persists until
  // the employer saves or manually edits a pre-filled field, so they see
  // the "Imported from LinkedIn" confirmation until they're done reviewing.
  const [importBanner, setImportBanner] = useState<null | { source: 'url' | 'text' }>(null)
  const [form, setForm] = useState({
    company_name: employer?.company_name || '',
    contact_name: employer?.contact_name || '',
    sector: employer?.sector || '',
    location: employer?.location || '',
    description: employer?.description || '',
    website_url: employer?.website_url || '',
    linkedin_url: employer?.linkedin_url || '',
    company_size: employer?.company_size || '',
    // Founded year is stored as a number but edited as a string so we can
    // show an empty input (rather than "0") when the value hasn't been set
    // yet. We parse back to int on submit.
    founded_year: employer?.founded_year ? String(employer.founded_year) : '',
  })

  // Re-sync form when employer loads
  if (employer && !form.company_name && employer.company_name) {
    setForm({
      company_name: employer.company_name,
      contact_name: employer.contact_name,
      sector: employer.sector,
      location: employer.location,
      description: employer.description,
      website_url: employer.website_url || '',
      linkedin_url: employer.linkedin_url || '',
      company_size: employer.company_size || '',
      founded_year: employer.founded_year ? String(employer.founded_year) : '',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employer) return <Navigate to="/employer/login" replace />

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  // handleLinkedInImport drops the AI-extracted fields into the form.
  // We ONLY overwrite fields the user hasn't edited (i.e., still match
  // the employer's saved profile) so a returning employer refreshing
  // from LinkedIn doesn't lose manual edits they made this session.
  const handleLinkedInImport = (profile: LinkedInProfile, source: 'url' | 'text') => {
    setForm(prev => ({
      ...prev,
      company_name: profile.company_name || prev.company_name,
      sector: profile.sector && SECTORS.includes(profile.sector) ? profile.sector : prev.sector,
      location: profile.location || prev.location,
      description: profile.description || prev.description,
      website_url: profile.website_url || prev.website_url,
      company_size:
        profile.company_size && COMPANY_SIZE_OPTIONS.includes(profile.company_size)
          ? profile.company_size
          : prev.company_size,
      founded_year: profile.founded_year ? String(profile.founded_year) : prev.founded_year,
    }))
    setImportBanner({ source })
    setError('')
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)

    // Coerce founded_year back to int. Empty string or junk → 0 (meaning
    // "unknown"). Backend also clamps; this just keeps the payload clean.
    const yearInt = parseInt(form.founded_year, 10)
    const payload = {
      ...form,
      founded_year: Number.isFinite(yearInt) ? yearInt : 0,
    }

    const res = await fetch('/api/employer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })
    const data = await res.json()
    if (res.ok) {
      updateEmployer(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(data.error || 'Failed to update profile')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Header */}
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
            <Link to="/employer/profile" className="text-sm font-medium text-white border-b-2 border-[var(--gold)] pb-0.5 no-underline cursor-pointer">
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

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="animate-fade-in-up mb-8">
          <h1 className="font-heading text-4xl text-[var(--navy)] tracking-wide">COMPANY PROFILE</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Keep your company information up to date — veterans can browse your full profile before they apply, so a
            richer page means better-matched candidates reaching out.
          </p>
          {employer.id ? (
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              Public view:{' '}
              <a
                href={`/companies/${employer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] underline"
              >
                /companies/{employer.id}
              </a>{' '}
              (opens the same page veterans see).
            </p>
          ) : null}
        </div>

        <LinkedInImportSection
          onImported={handleLinkedInImport}
          sectorOptions={SECTORS}
        />

        {importBanner && (
          <div className="mb-6 bg-[var(--navy)]/5 border border-[var(--navy)]/20 text-[var(--navy)] px-5 py-4 rounded-sm animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--gold)] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--navy)" strokeWidth="2.5">
                  <path d="M3 7L6 10L11 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold">
                  Imported from LinkedIn {importBanner.source === 'url' ? '(page URL)' : '(pasted text)'}
                </div>
                <div className="text-sm text-[var(--muted-foreground)] mt-1">
                  Review the fields below and hit <strong>Save Changes</strong> when you're ready.
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-5" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
              {error}
            </div>
          )}

          {/* Identity — who the company is */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">COMPANY NAME *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={e => updateField('company_name', e.target.value)}
              required
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">CONTACT NAME</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => updateField('contact_name', e.target.value)}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">SECTOR</label>
              <select
                value={form.sector}
                onChange={e => updateField('sector', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors cursor-pointer"
              >
                <option value="">Select sector</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">HEADQUARTERS</label>
              <input
                type="text"
                value={form.location}
                onChange={e => updateField('location', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="Houston, TX"
              />
            </div>
          </div>

          {/* About */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">COMPANY DESCRIPTION</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
              placeholder="Tell veterans about your company, culture, and what makes it a great place to work..."
            />
          </div>

          {/* Public links & company facts — the block the new veteran-
             facing company profile page depends on. */}
          <div className="border-t border-[var(--sand-dark)] pt-5 mt-2">
            <h2 className="font-heading text-base tracking-widest text-[var(--gold-dark)] mb-1">PUBLIC COMPANY INFO</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4 leading-relaxed">
              Helps veterans research your company before applying. Displayed on your public{' '}
              <strong>/companies/{employer.id || ':id'}</strong> profile page along with your active listings.
            </p>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">COMPANY WEBSITE</label>
              <input
                type="url"
                value={form.website_url}
                onChange={e => updateField('website_url', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="https://www.example.com"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">LINKEDIN COMPANY PAGE</label>
              <input
                type="url"
                value={form.linkedin_url}
                onChange={e => updateField('linkedin_url', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="https://www.linkedin.com/company/your-company/"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">COMPANY SIZE</label>
                <select
                  value={form.company_size}
                  onChange={e => updateField('company_size', e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors cursor-pointer"
                >
                  <option value="">Select size</option>
                  {COMPANY_SIZE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">FOUNDED</label>
                <input
                  type="number"
                  value={form.founded_year}
                  onChange={e => updateField('founded_year', e.target.value)}
                  min="1600"
                  max={CURRENT_YEAR}
                  step="1"
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  placeholder="e.g. 1985"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`font-semibold px-8 py-3.5 rounded-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-[var(--navy)] text-white hover:bg-[var(--navy-light)]'
              }`}
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          <div className="border-t border-[var(--sand-dark)] pt-5 mt-8">
            <p className="text-xs text-[var(--muted-foreground)]">
              Email: <strong>{employer.email}</strong> — contact support to change your account email.
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
