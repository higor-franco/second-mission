import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useEmployerAuth } from '@/lib/employer-auth'

const SECTORS = [
  'Energy & Oil/Gas',
  'Construction',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Field Operations',
  'Maintenance & Repair',
  'Other',
]

export default function EmployerProfilePage() {
  const { employer, loading, logout, updateEmployer } = useEmployerAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    company_name: employer?.company_name || '',
    contact_name: employer?.contact_name || '',
    sector: employer?.sector || '',
    location: employer?.location || '',
    description: employer?.description || '',
  })

  // Re-sync form when employer loads
  if (employer && !form.company_name && employer.company_name) {
    setForm({
      company_name: employer.company_name,
      contact_name: employer.contact_name,
      sector: employer.sector,
      location: employer.location,
      description: employer.description,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)

    const res = await fetch('/api/employer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
            Keep your company information up to date so veterans can learn about your organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-5" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
              {error}
            </div>
          )}

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
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">LOCATION</label>
              <input
                type="text"
                value={form.location}
                onChange={e => updateField('location', e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="Houston, TX"
              />
            </div>
          </div>

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
