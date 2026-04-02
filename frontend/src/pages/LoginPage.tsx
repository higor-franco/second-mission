import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { veteran, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [devLink, setDevLink] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Already logged in — redirect to dashboard
  if (!loading && veteran) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      const result = await login(email)
      if (result.ok) {
        setSubmitted(true)
        setMessage(result.message)
        if (result.dev_link) {
          setDevLink(result.dev_link)
        }
      } else {
        setError(result.message)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--cream)]/90 backdrop-blur-md border-b border-[var(--sand-dark)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center">
          <Link to="/" className="flex items-center gap-3 no-underline group cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto" />
            <span className="font-heading text-2xl tracking-wider text-[var(--navy)] leading-none">
              SECOND MISSION
            </span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {!submitted ? (
            <div className="animate-fade-in-up">
              {/* Icon */}
              <div className="w-16 h-16 bg-[var(--navy)] rounded-sm flex items-center justify-center mx-auto mb-8">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--gold)" strokeWidth="1.5">
                  <rect x="4" y="8" width="24" height="18" rx="2" />
                  <path d="M4 12L16 20L28 12" />
                </svg>
              </div>

              <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide text-center mb-3">
                SIGN IN
              </h1>
              <p className="text-center text-[var(--muted-foreground)] mb-10">
                Enter your email and we'll send you a magic link — no password needed.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-[var(--navy)] mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3.5 bg-white border border-[var(--sand-dark)] rounded-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent transition-shadow"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || !email}
                  className="w-full bg-[var(--navy)] text-white font-semibold text-lg px-6 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Magic Link'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-[var(--muted-foreground)] mt-8">
                Free for all veterans. No credit card required.
              </p>
            </div>
          ) : (
            /* Success state — check your email */
            <div className="animate-scale-in text-center">
              <div className="w-20 h-20 bg-[var(--gold)]/10 border-2 border-[var(--gold)] rounded-full flex items-center justify-center mx-auto mb-8">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="var(--gold-dark)" strokeWidth="2">
                  <rect x="4" y="8" width="28" height="20" rx="2" />
                  <path d="M4 12L18 22L32 12" />
                </svg>
              </div>

              <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide mb-4">
                {devLink ? 'DEV MODE' : 'CHECK YOUR EMAIL'}
              </h1>
              <p className="text-[var(--muted-foreground)] mb-3 leading-relaxed max-w-sm mx-auto">
                {message}
              </p>

              {devLink ? (
                <a
                  href={devLink}
                  className="inline-block mt-4 bg-[var(--navy)] text-white font-semibold text-lg px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all hover:translate-y-[-1px] hover:shadow-lg no-underline cursor-pointer"
                >
                  Click here to sign in
                </a>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  The link expires in <strong className="text-[var(--navy)]">15 minutes</strong>.
                </p>
              )}

              <button
                onClick={() => { setSubmitted(false); setEmail(''); setDevLink(null); }}
                className="mt-10 text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors cursor-pointer bg-transparent border-none"
              >
                ← Use a different email
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
