import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'

interface CivilianRole {
  id: number
  onet_code: string
  title: string
  description: string
  sector: string
  avg_salary_min: number
  avg_salary_max: number
}

const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship / SkillBridge' },
]

export default function EmployerNewListingPage() {
  const { employer, loading } = useEmployerAuth()
  const navigate = useNavigate()
  const [roles, setRoles] = useState<CivilianRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
    tasks: '',
    benefits: '',
    mos_codes_preferred: '',
  })

  useEffect(() => {
    fetch('/api/civilian-roles', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRoles(data.roles || []))
      .catch(() => {})
      .finally(() => setRolesLoading(false))
  }, [])

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

  const handleRoleSelect = (roleId: number) => {
    const role = roles.find(r => r.id === roleId)
    if (role) {
      setForm(prev => ({
        ...prev,
        civilian_role_id: roleId,
        title: prev.title || role.title,
        salary_min: prev.salary_min || String(role.avg_salary_min),
        salary_max: prev.salary_max || String(role.avg_salary_max),
      }))
    } else {
      updateField('civilian_role_id', roleId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.civilian_role_id) {
      setError('Please select a civilian role category')
      return
    }
    if (!form.title.trim()) {
      setError('Job title is required')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/employer/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        civilian_role_id: form.civilian_role_id,
        title: form.title,
        description: form.description,
        requirements: form.requirements.split('\n').filter(s => s.trim()),
        location: form.location || employer.location,
        salary_min: Number(form.salary_min) || 0,
        salary_max: Number(form.salary_max) || 0,
        employment_type: form.employment_type,
        wotc_eligible: form.wotc_eligible,
        tasks: form.tasks.split('\n').filter(s => s.trim()),
        benefits: form.benefits.split('\n').filter(s => s.trim()),
        mos_codes_preferred: form.mos_codes_preferred.split(',').map(s => s.trim()).filter(Boolean),
      }),
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to create listing')
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/employer/dashboard'), 1500)
    }
    setSubmitting(false)
  }

  // Group roles by sector
  const sectorGroups = roles.reduce<Record<string, CivilianRole[]>>((acc, role) => {
    if (!acc[role.sector]) acc[role.sector] = []
    acc[role.sector].push(role)
    return acc
  }, {})

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
          <Link to="/employer/dashboard" className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="animate-fade-in-up mb-8">
          <h1 className="font-heading text-4xl text-[var(--navy)] tracking-wide">POST NEW LISTING</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Describe the role in terms of tasks, not just titles. Veterans match better when they see what the job actually involves.
          </p>
        </div>

        {success && (
          <div className="animate-scale-in bg-green-50 border border-green-200 text-green-700 text-sm px-6 py-4 rounded-sm mb-6">
            Listing created successfully! Redirecting to dashboard...
          </div>
        )}

        <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-6" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
              {error}
            </div>
          )}

          {/* Role category */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
              CIVILIAN ROLE CATEGORY *
            </label>
            {rolesLoading ? (
              <div className="text-sm text-[var(--muted-foreground)]">Loading roles...</div>
            ) : (
              <select
                value={form.civilian_role_id}
                onChange={e => handleRoleSelect(Number(e.target.value))}
                required
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors cursor-pointer"
              >
                <option value={0}>Select a role category...</option>
                {Object.entries(sectorGroups).map(([sector, sRoles]) => (
                  <optgroup key={sector} label={sector}>
                    {sRoles.map(role => (
                      <option key={role.id} value={role.id}>{role.title} ({role.onet_code})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              This determines which veterans are matched to your listing based on their MOS translation scores.
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
              placeholder="e.g., Field Operations Technician"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">DESCRIPTION</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
              placeholder="Describe the role and what a typical day looks like..."
            />
          </div>

          {/* Tasks */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
              KEY TASKS (one per line)
            </label>
            <textarea
              value={form.tasks}
              onChange={e => updateField('tasks', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
              placeholder={"Inspect and maintain heavy equipment\nCoordinate field crew logistics\nManage inventory and supply chain"}
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Task-level descriptions help veterans recognize transferable skills from their military experience.
            </p>
          </div>

          {/* Salary + Type + Location */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">SALARY MIN</label>
              <input
                type="number"
                value={form.salary_min}
                onChange={e => updateField('salary_min', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="48000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">SALARY MAX</label>
              <input
                type="number"
                value={form.salary_max}
                onChange={e => updateField('salary_max', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="78000"
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
                placeholder={employer.location || "Houston, TX"}
              />
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
              REQUIREMENTS (one per line)
            </label>
            <textarea
              value={form.requirements}
              onChange={e => updateField('requirements', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
              placeholder={"Valid driver's license\nAbility to lift 50 lbs\nWillingness to work outdoors"}
            />
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
              BENEFITS (one per line)
            </label>
            <textarea
              value={form.benefits}
              onChange={e => updateField('benefits', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
              placeholder={"Health insurance\n401(k) matching\nPaid training"}
            />
          </div>

          {/* MOS codes + WOTC */}
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
                placeholder="88M, 91B, 92Y"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Optional — helps highlight candidates with direct MOS matches.
              </p>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.wotc_eligible}
                  onChange={e => updateField('wotc_eligible', e.target.checked)}
                  className="w-5 h-5 accent-[var(--navy)] cursor-pointer"
                />
                <span className="text-sm text-[var(--navy)] font-medium">
                  WOTC Eligible Position
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting || success}
              className="bg-[var(--navy)] text-white font-semibold px-8 py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : success ? 'Created!' : 'Post Listing'}
            </button>
            <Link
              to="/employer/dashboard"
              className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
