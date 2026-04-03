import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function EmployerForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [devLink, setDevLink] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    setDevLink('')

    try {
      const res = await fetch('/api/employer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
        if (data.dev_link) {
          setDevLink(data.dev_link)
        }
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
            RESET YOUR
            <br />
            <span className="text-[var(--gold)]">PASSWORD</span>
          </h2>
          <p className="text-[var(--sand)] mt-4 max-w-sm leading-relaxed">
            No worries — it happens to everyone. Enter your email and we'll send you a secure link to create a new password.
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

          {!submitted ? (
            <>
              <div className="animate-fade-in-up">
                <span className="inline-block text-xs font-semibold tracking-[0.2em] text-[var(--gold-dark)] mb-2">
                  ACCOUNT RECOVERY
                </span>
                <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
                  FORGOT PASSWORD
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                  Enter the email address you used to create your employer account. We'll send you a link to reset your password.
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--navy)] text-white font-semibold py-3.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="animate-fade-in-up">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--navy)]/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 4L12 13L2 4" />
                </svg>
              </div>
              <span className="inline-block text-xs font-semibold tracking-[0.2em] text-[var(--gold-dark)] mb-2">
                CHECK YOUR INBOX
              </span>
              <h1 className="font-heading text-4xl tracking-wide text-[var(--navy)]">
                EMAIL SENT
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
                If <strong className="text-[var(--navy)]">{email}</strong> is registered, you'll receive a password reset link shortly. The link expires in 15 minutes.
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-2">
                Don't see it? Check your spam folder.
              </p>

              {devLink && (
                <div className="mt-6 bg-amber-50 border border-amber-300 rounded-sm px-4 py-3">
                  <p className="text-xs font-semibold tracking-wider text-amber-700 mb-1">DEV MODE</p>
                  <a
                    href={devLink}
                    className="text-sm text-[var(--navy)] font-semibold hover:text-[var(--gold-dark)] transition-colors break-all no-underline cursor-pointer"
                  >
                    Click here to reset password
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="animate-fade-in-up mt-8 text-center" style={{ animationDelay: '0.15s' }}>
            <p className="text-sm text-[var(--muted-foreground)]">
              Remember your password?{' '}
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
