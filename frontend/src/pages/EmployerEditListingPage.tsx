import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'

// Edit page for an existing listing. Intentionally parallel to
// EmployerNewListingPage so the form looks and behaves identically — the
// only differences are the endpoints (GET to load, PUT to save), the
// submit button label, and the inclusion of `is_active` in the payload
// (the new-listing form defaults that to true server-side).

interface CivilianRole {
  id: number
  onet_code: string
  title: string
  description: string
  sector: string
  avg_salary_min: number
  avg_salary_max: number
}

interface ExistingListing {
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
  tasks: string[]
  benefits: string[]
  mos_codes_preferred: string[]
  civilian_role_id: number
}

const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship / SkillBridge' },
]

export default function EmployerEditListingPage() {
  const { id } = useParams<{ id: string }>()
  const { employer, loading } = useEmployerAuth()
  const navigate = useNavigate()
  const [roles, setRoles] = useState<CivilianRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [listingLoading, setListingLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // The form mirrors EmployerNewListingPage. Arrays are stored as
  // newline-joined strings for easy editing; we split them back on submit.
  const [form, setForm] = useState({
    civilian_role_id: 0,
    title: '',
    description: '',
    requirements: '',
    location: '',
    salary_min: '',
    salary_max: '',
    employment_type: 'full-time',
    wotc_eligible: true,
    is_active: true,
    tasks: '',
    benefits: '',
    mos_codes_preferred: '',
  })

  // Load civilian roles in parallel with the listing itself — they're
  // independent and the form can't save until both resolve.
  useEffect(() => {
    fetch('/api/civilian-roles', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRoles(data.roles || []))
      .catch(() => {})
      .finally(() => setRolesLoading(false))
  }, [])

  useEffect(() => {
    if (!employer || !id) return
    setListingLoading(true)
    fetch(`/api/employer/listings/${id}`, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed (${res.status})`)
        }
        return res.json()
      })
      .then((listing: ExistingListing) => {
        setForm({
          civilian_role_id: listing.civilian_role_id,
          title: listing.title,
          description: listing.description,
          requirements: (listing.requirements || []).join('\n'),
          location: listing.location,
          salary_min: listing.salary_min ? String(listing.salary_min) : '',
          salary_max: listing.salary_max ? String(listing.salary_max) : '',
          employment_type: listing.employment_type,
          wotc_eligible: listing.wotc_eligible,
          is_active: listing.is_active,
          tasks: (listing.tasks || []).join('\n'),
          benefits: (listing.benefits || []).join('\n'),
          mos_codes_preferred: (listing.mos_codes_preferred || []).join(', '),
        })
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load listing'))
      .finally(() => setListingLoading(false))
  }, [employer, id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employer) return <Navigate to="/employer/login" replace />

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) {
      setError('Job title is required')
      return
    }

    setSubmitting(true)
    const res = await fetch(`/api/employer/listings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        requirements: form.requirements.split('\n').filter(s => s.trim()),
        location: form.location || employer.location,
        salary_min: Number(form.salary_min) || 0,
        salary_max: Number(form.salary_max) || 0,
        employment_type: form.employment_type,
        wotc_eligible: form.wotc_eligible,
        is_active: form.is_active,
        tasks: form.tasks.split('\n').filter(s => s.trim()),
        benefits: form.benefits.split('\n').filter(s => s.trim()),
        mos_codes_preferred: form.mos_codes_preferred.split(',').map(s => s.trim()).filter(Boolean),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to save listing')
    } else {
      setSuccess(true)
      setTimeout(() => navigate(`/employer/listings/${id}`), 1200)
    }
    setSubmitting(false)
  }

  // Group roles by sector — same UX as the new-listing form. The select
  // is read-only for the current category since the backend UpdateJobListing
  // doesn't change civilian_role_id; we show it so the employer has context
  // on which role category the listing belongs to.
  const currentRole = roles.find(r => r.id === form.civilian_role_id)

  return (
    <div className="min-h-screen bg-[var(--cream)]">
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
          <Link to={`/employer/listings/${id}`} className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
            ← Back to Listing
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="animate-fade-in-up mb-8">
          <h1 className="font-heading text-4xl text-[var(--navy)] tracking-wide">EDIT LISTING</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Update the role details. Changes are visible to matched veterans immediately once you save.
          </p>
        </div>

        {loadError && !listingLoading && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-sm mb-6">
            {loadError}
          </div>
        )}

        {(listingLoading || rolesLoading) && !loadError && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!listingLoading && !loadError && (
          <>
            {success && (
              <div className="animate-scale-in bg-green-50 border border-green-200 text-green-700 text-sm px-6 py-4 rounded-sm mb-6">
                Listing updated successfully! Redirecting...
              </div>
            )}

            <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-6" style={{ animationDelay: '0.1s' }}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
                  {error}
                </div>
              )}

              {/* Role category — shown as read-only; changing civilian role
                  category would break existing match scores, so if that's
                  needed the employer can pause and re-post under a new
                  category. */}
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                  CIVILIAN ROLE CATEGORY
                </label>
                <div className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-[var(--sand)]/40 text-[var(--navy)]">
                  {currentRole ? `${currentRole.title} (${currentRole.onet_code}) — ${currentRole.sector}` : 'Loading…'}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  To change the category, pause this listing and post a new one — this keeps existing match scores stable.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">JOB TITLE *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">DESCRIPTION</label>
                <textarea
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                  KEY TASKS (one per line)
                </label>
                <textarea
                  value={form.tasks}
                  onChange={e => updateField('tasks', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">SALARY MIN</label>
                  <input
                    type="number"
                    value={form.salary_min}
                    onChange={e => updateField('salary_min', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">SALARY MAX</label>
                  <input
                    type="number"
                    value={form.salary_max}
                    onChange={e => updateField('salary_max', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">TYPE</label>
                  <select
                    value={form.employment_type}
                    onChange={e => updateField('employment_type', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors cursor-pointer"
                  >
                    {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">LOCATION</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => updateField('location', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                    placeholder={employer.location || 'Houston, TX'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                  REQUIREMENTS (one per line)
                </label>
                <textarea
                  value={form.requirements}
                  onChange={e => updateField('requirements', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                  BENEFITS (one per line)
                </label>
                <textarea
                  value={form.benefits}
                  onChange={e => updateField('benefits', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                    PREFERRED MOS CODES (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.mos_codes_preferred}
                    onChange={e => updateField('mos_codes_preferred', e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  />
                </div>
                <div className="flex items-end pb-1 gap-5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.wotc_eligible}
                      onChange={e => updateField('wotc_eligible', e.target.checked)}
                      className="w-5 h-5 accent-[var(--navy)] cursor-pointer"
                    />
                    <span className="text-sm text-[var(--navy)] font-medium">WOTC Eligible</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => updateField('is_active', e.target.checked)}
                      className="w-5 h-5 accent-[var(--navy)] cursor-pointer"
                    />
                    <span className="text-sm text-[var(--navy)] font-medium">Active (visible to veterans)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting || success}
                  className="bg-[var(--navy)] text-white font-semibold px-8 py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : success ? 'Saved!' : 'Save Changes'}
                </button>
                <Link
                  to={`/employer/listings/${id}`}
                  className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
