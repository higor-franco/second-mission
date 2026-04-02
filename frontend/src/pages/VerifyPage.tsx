import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function VerifyPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    // The /auth/verify endpoint sets the cookie and redirects to /dashboard.
    // We redirect the browser there directly so the cookie is set by the server.
    window.location.href = `/auth/verify?token=${encodeURIComponent(token)}`
  }, [token])

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center px-6">
        <div className="animate-scale-in text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 border-2 border-red-300 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <path d="M12 12L24 24M24 12L12 24" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-heading text-4xl text-[var(--navy)] tracking-wide mb-4">
            INVALID LINK
          </h1>
          <p className="text-[var(--muted-foreground)] mb-8">
            This magic link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold px-8 py-4 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  // Verifying state — browser will redirect via window.location
  return (
    <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center px-6">
      <div className="animate-fade-in-up text-center">
        <div className="w-16 h-16 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin mx-auto mb-8" />
        <h1 className="font-heading text-3xl text-[var(--navy)] tracking-wide mb-3">
          VERIFYING YOUR LINK
        </h1>
        <p className="text-[var(--muted-foreground)]">Just a moment...</p>
      </div>
    </div>
  )
}
