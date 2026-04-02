import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface MatchedRole {
  onet_code: string
  title: string
  description: string
  sector: string
  salary_min: number
  salary_max: number
  match_score: number
  transferable_skills: string[]
}

export default function DashboardPage() {
  const { veteran, loading, logout } = useAuth()
  const [roles, setRoles] = useState<MatchedRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesMessage, setRolesMessage] = useState('')

  useEffect(() => {
    if (!veteran) return

    fetch('/api/veteran/matches', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setRoles(data.roles || [])
        setRolesMessage(data.message || '')
      })
      .catch(() => setRolesMessage('Failed to load matches.'))
      .finally(() => setRolesLoading(false))
  }, [veteran])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!veteran) {
    return <Navigate to="/login" replace />
  }

  const formatSalary = (n: number) =>
    '$' + (n / 1000).toFixed(0) + 'K'

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Dashboard Header */}
      <header className="bg-[var(--navy)] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline group cursor-pointer">
            <img src="/logo.png" alt="Second Mission" className="h-10 w-auto brightness-0 invert" />
            <span className="font-heading text-2xl tracking-wider text-white leading-none">
              SECOND MISSION
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/profile"
              className="text-sm font-medium text-[var(--sand)] hover:text-white transition-colors no-underline cursor-pointer"
            >
              Profile
            </Link>
            <button
              onClick={logout}
              className="text-sm font-medium text-[var(--sand-dark)] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome Section */}
        <div className="animate-fade-in-up mb-10">
          <h1 className="font-heading text-4xl md:text-5xl text-[var(--navy)] tracking-wide">
            {veteran.name ? `WELCOME BACK, ${veteran.name.toUpperCase()}` : 'WELCOME, VETERAN'}
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            {veteran.email}
            {veteran.mos_code && (
              <span className="ml-3 inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm">
                MOS: {veteran.mos_code}
              </span>
            )}
          </p>
        </div>

        {/* Profile Completion Banner */}
        {!veteran.profile_complete && (
          <div className="animate-fade-in-up bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-sm p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ animationDelay: '0.1s' }}>
            <div>
              <h3 className="font-heading text-xl tracking-wider text-[var(--navy)]">COMPLETE YOUR PROFILE</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Add your MOS code, rank, and service details to get personalized career matches.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 bg-[var(--gold)] text-[var(--navy-dark)] font-semibold px-6 py-3 rounded-sm hover:bg-[var(--gold-light)] transition-all cursor-pointer no-underline text-sm whitespace-nowrap"
            >
              Complete Profile →
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-6" style={{ animationDelay: '0.1s' }}>
            <div className="text-sm text-[var(--muted-foreground)]">Career Matches</div>
            <div className="font-heading text-4xl text-[var(--navy)] mt-1">{roles.length}</div>
          </div>
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-6" style={{ animationDelay: '0.15s' }}>
            <div className="text-sm text-[var(--muted-foreground)]">Avg. Match Score</div>
            <div className="font-heading text-4xl text-[var(--gold)]">
              {roles.length > 0
                ? Math.round(roles.reduce((sum, r) => sum + r.match_score, 0) / roles.length) + '%'
                : '—'}
            </div>
          </div>
          <div className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-6" style={{ animationDelay: '0.2s' }}>
            <div className="text-sm text-[var(--muted-foreground)]">Profile Status</div>
            <div className="font-heading text-4xl text-[var(--navy)]">
              {veteran.profile_complete ? (
                <span className="text-green-600">COMPLETE</span>
              ) : (
                <span className="text-[var(--gold)]">PENDING</span>
              )}
            </div>
          </div>
        </div>

        {/* Matched Roles */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-3xl tracking-wider text-[var(--navy)]">YOUR CAREER MATCHES</h2>
            {veteran.mos_code && (
              <span className="text-sm text-[var(--muted-foreground)]">
                Based on MOS <strong className="text-[var(--navy)]">{veteran.mos_code}</strong>
              </span>
            )}
          </div>

          {rolesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : roles.length === 0 ? (
            <div className="bg-white border border-[var(--sand-dark)] rounded-sm p-12 text-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--sand-dark)" strokeWidth="1.5" className="mx-auto mb-4">
                <circle cx="20" cy="20" r="14" /><path d="M30 30L42 42" strokeLinecap="round" strokeWidth="2.5" />
              </svg>
              <h3 className="font-heading text-2xl text-[var(--navy)] tracking-wide mb-2">NO MATCHES YET</h3>
              <p className="text-[var(--muted-foreground)] max-w-md mx-auto">
                {rolesMessage || "Complete your profile with your MOS code to see personalized career matches."}
              </p>
              {!veteran.mos_code && (
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 bg-[var(--navy)] text-white font-semibold px-6 py-3 rounded-sm mt-6 hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
                >
                  Add Your MOS Code
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role, i) => (
                <div
                  key={role.onet_code}
                  className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-6 hover:border-[var(--gold)] hover:shadow-lg transition-all group"
                  style={{ animationDelay: `${0.05 * i}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-2.5 py-0.5 rounded-sm">
                        {role.sector.toUpperCase()}
                      </span>
                      <h3 className="font-heading text-xl tracking-wider text-[var(--navy)] mt-2">{role.title}</h3>
                    </div>
                    {/* Match score circle */}
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-dark)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.5" fill="none"
                          stroke={role.match_score >= 85 ? 'var(--gold)' : role.match_score >= 70 ? 'var(--navy)' : 'var(--muted-foreground)'}
                          strokeWidth="3"
                          strokeDasharray={`${(role.match_score / 100) * 97.4} 97.4`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--navy)]">
                        {role.match_score}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-3 line-clamp-2">{role.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-heading text-lg text-[var(--navy)]">
                        {formatSalary(role.salary_min)} – {formatSalary(role.salary_max)}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)] ml-1">/ year</span>
                    </div>
                  </div>
                  {role.transferable_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {role.transferable_skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="text-xs bg-[var(--sand)] text-[var(--navy)] px-2 py-0.5 rounded-sm">
                          {skill}
                        </span>
                      ))}
                      {role.transferable_skills.length > 4 && (
                        <span className="text-xs text-[var(--muted-foreground)] px-1">
                          +{role.transferable_skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
