import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAdminAuth } from '@/lib/admin-auth'

export default function AdminLoginPage() {
  const { admin, loading, login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (admin) return <Navigate to="/admin/dashboard" replace />

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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(198,165,90,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(198,165,90,0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--navy)] rounded-full blur-[200px] opacity-30" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and heading */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-3 no-underline cursor-pointer mb-6">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto brightness-0 invert opacity-60" />
            <span className="font-heading text-2xl tracking-wider text-white/60 leading-none">
              SECOND MISSION
            </span>
          </Link>
          <h1 className="font-heading text-5xl tracking-wide text-white leading-none mb-2">
            COMMAND <span className="text-[var(--gold)]">CENTER</span>
          </h1>
          <p className="text-white/40 text-sm font-sans mt-3">Platform Administration</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-[#161b22] border border-white/10 rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-white/50 text-xs font-sans font-semibold uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0d1117] border border-white/10 rounded px-4 py-3 text-white font-sans placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 transition-colors"
              placeholder="admin@secondmission.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-white/50 text-xs font-sans font-semibold uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0d1117] border border-white/10 rounded px-4 py-3 text-white font-sans placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 transition-colors"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--gold)] hover:bg-[var(--gold-light)] text-[#0d1117] font-heading text-xl tracking-wider py-3 rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'AUTHENTICATING...' : 'SIGN IN'}
          </button>
        </form>

        <p className="text-center mt-6 text-white/20 text-xs font-sans">
          <Link to="/" className="text-white/30 hover:text-white/50 transition-colors cursor-pointer">
            Back to main site
          </Link>
        </p>
      </div>
    </div>
  )
}
