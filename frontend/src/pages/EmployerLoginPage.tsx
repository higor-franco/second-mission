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

export default function EmployerLoginPage() {
  const { employer, loading, login } = useEmployerAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (employer) return <Navigate to="/employer/dashboard" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login(email, password)
    if (!result.ok) {
      setError(result.message)
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[var(--navy)] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 pattern-stripes opacity-10" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 no-underline cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-12 w-auto brightness-0 invert" />
            <span className="font-heading text-3xl tracking-wider text-white leading-none">
              SECOND MISSION
            </span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="font-heading text-5xl tracking-wide text-white leading-[0.95]">
            EMPLOYER
            <br />
            <span className="text-[var(--gold)]">PORTAL</span>
          </h2>
          <p className="text-[var(--sand)] mt-4 max-w-sm leading-relaxed">
            Access your talent pipeline. Browse pre-qualified veterans matched to your roles.
            Manage listings and track candidates through placement.
          </p>
        </div>
        <div className="relative z-10 text-xs text-[var(--sand-dark)]">
          Free for veterans. Built for employers.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10">
            <Link to="/" className="flex items-center gap-3 no-underline cursor-pointer">
              <img src="/logo.png" alt="Second Mission" className="h-10 w-auto" />
              <span className="font-heading text-2xl tracking-wider text-[var(--navy)] leading-none">
                SECOND MISSION
              </span>
            </Link>
          </div>

          <div className="animate-fade-in-up">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] text-[var(--gold-dark)] mb-2">
              EMPLOYER ACCESS
            </span>
            <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
              SIGN IN
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              Access your employer dashboard and talent pipeline.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="animate-fade-in-up mt-8 space-y-5" style={{ animationDelay: '0.1s' }}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--navy)] text-white font-semibold py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="animate-fade-in-up mt-8 text-center" style={{ animationDelay: '0.15s' }}>
            <p className="text-sm text-[var(--muted-foreground)]">
              Don't have an account?{' '}
              <Link to="/employer/register" className="font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors no-underline cursor-pointer">
                Create Employer Account
              </Link>
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-3">
              Are you a veteran?{' '}
              <Link to="/login" className="text-[var(--gold-dark)] hover:text-[var(--navy)] transition-colors no-underline cursor-pointer">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmployerRegisterPage() {
  const { employer, loading, register } = useEmployerAuth()
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    contact_name: '',
    sector: '',
    location: '',
    description: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (employer) return <Navigate to="/employer/dashboard" replace />

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!form.company_name.trim()) {
      setError('Company name is required')
      return
    }

    setSubmitting(true)
    const result = await register({
      email: form.email,
      password: form.password,
      company_name: form.company_name,
      contact_name: form.contact_name,
      sector: form.sector,
      location: form.location,
      description: form.description,
    })
    if (!result.ok) {
      setError(result.message)
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[var(--navy)] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 pattern-stripes opacity-10" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 no-underline cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-12 w-auto brightness-0 invert" />
            <span className="font-heading text-3xl tracking-wider text-white leading-none">
              SECOND MISSION
            </span>
          </Link>
        </div>
        <div className="relative z-10">
          <h2 className="font-heading text-5xl tracking-wide text-white leading-[0.95]">
            JOIN THE
            <br />
            <span className="text-[var(--gold)]">PIPELINE</span>
          </h2>
          <p className="text-[var(--sand)] mt-4 max-w-sm leading-relaxed">
            Create your employer account to start receiving pre-qualified veteran
            candidates matched to your open roles.
          </p>
          <div className="mt-6 space-y-3">
            {['AI-matched veteran talent', 'WOTC credit facilitation', 'Task-level skill translation'].map(item => (
              <div key={item} className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--gold)" strokeWidth="2">
                  <path d="M3 8L7 12L13 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm text-[var(--sand)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-[var(--sand-dark)]">
          Trusted by NOV, GE Vernova, and Texas employers.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-3 no-underline cursor-pointer">
              <img src="/logo.png" alt="Second Mission" className="h-10 w-auto" />
              <span className="font-heading text-2xl tracking-wider text-[var(--navy)] leading-none">
                SECOND MISSION
              </span>
            </Link>
          </div>

          <div className="animate-fade-in-up">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] text-[var(--gold-dark)] mb-2">
              CREATE ACCOUNT
            </span>
            <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
              EMPLOYER REGISTRATION
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="animate-fade-in-up mt-6 space-y-4" style={{ animationDelay: '0.1s' }}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">COMPANY NAME *</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => updateField('company_name', e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  placeholder="ACME Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">CONTACT NAME</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={e => updateField('contact_name', e.target.value)}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  placeholder="John Smith"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">WORK EMAIL *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                required
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">PASSWORD *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => updateField('password', e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  placeholder="Min 8 chars"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">CONFIRM *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => updateField('confirmPassword', e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                  placeholder="Confirm"
                />
              </div>
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
                rows={3}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors resize-none"
                placeholder="Brief description of your company and hiring needs..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--navy)] text-white font-semibold py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating account...' : 'Create Employer Account'}
            </button>
          </form>

          <div className="animate-fade-in-up mt-6 text-center" style={{ animationDelay: '0.15s' }}>
            <p className="text-sm text-[var(--muted-foreground)]">
              Already have an account?{' '}
              <Link to="/employer/login" className="font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors no-underline cursor-pointer">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
