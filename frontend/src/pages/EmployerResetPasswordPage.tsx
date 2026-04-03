import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function EmployerResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex">
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
              INVALID
              <br />
              <span className="text-[var(--gold)]">LINK</span>
            </h2>
          </div>
          <div className="relative z-10 text-xs text-[var(--sand-dark)]">
            Free for veterans. Built for employers.
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="font-heading text-3xl tracking-wide text-[var(--navy)]">INVALID RESET LINK</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-3">
              This password reset link is missing or malformed. Please request a new one.
            </p>
            <Link
              to="/employer/forgot-password"
              className="inline-block mt-6 bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-colors no-underline cursor-pointer"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/employer/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
            {success ? 'PASSWORD' : 'NEW'}
            <br />
            <span className="text-[var(--gold)]">{success ? 'UPDATED' : 'PASSWORD'}</span>
          </h2>
          <p className="text-[var(--sand)] mt-4 max-w-sm leading-relaxed">
            {success
              ? 'Your password has been updated. You can now sign in with your new credentials.'
              : 'Choose a strong password for your employer account. Minimum 8 characters.'}
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

          {!success ? (
            <>
              <div className="animate-fade-in-up">
                <span className="inline-block text-xs font-semibold tracking-[0.2em] text-[var(--gold-dark)] mb-2">
                  ACCOUNT RECOVERY
                </span>
                <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
                  SET NEW PASSWORD
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                  Enter your new password below. Make it at least 8 characters.
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
                    NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                    placeholder="Min 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors"
                    placeholder="Confirm your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--navy)] text-white font-semibold py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="animate-fade-in-up">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <span className="inline-block text-xs font-semibold tracking-[0.2em] text-green-600 mb-2">
                SUCCESS
              </span>
              <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
                PASSWORD RESET
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <Link
                to="/employer/login"
                className="inline-block mt-6 w-full text-center bg-[var(--navy)] text-white font-semibold py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors no-underline cursor-pointer"
              >
                Sign In
              </Link>
            </div>
          )}

          <div className="animate-fade-in-up mt-8 text-center" style={{ animationDelay: '0.15s' }}>
            <p className="text-sm text-[var(--muted-foreground)]">
              <Link to="/employer/login" className="font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors no-underline cursor-pointer">
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
