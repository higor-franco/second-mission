import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface MOSCode {
  code: string
  title: string
  branch: string
  description: string
}

interface TranslatedRole {
  onet_code: string
  title: string
  description: string
  sector: string
  salary_min: number
  salary_max: number
  match_score: number
  transferable_skills: string[]
}

interface TranslateResponse {
  mos: MOSCode
  roles: TranslatedRole[]
}

function formatSalary(amount: number): string {
  return `$${Math.round(amount / 1000)}K`
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 80) return 'bg-[var(--gold)]'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-orange-400'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  return 'Moderate Match'
}

export default function TranslatePage() {
  const [mosCodes, setMosCodes] = useState<MOSCode[]>([])
  const [selectedMOS, setSelectedMOS] = useState('')
  const [result, setResult] = useState<TranslateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/mos-codes')
      .then(res => res.json())
      .then(setMosCodes)
      .catch(() => setError('Failed to load MOS codes'))
  }, [])

  async function handleTranslate() {
    if (!selectedMOS) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/translate?mos=${encodeURIComponent(selectedMOS)}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Translation failed')
      }
      const data: TranslateResponse = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-[var(--navy)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[var(--gold)] rounded-full blur-[150px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block font-heading text-sm tracking-[0.3em] text-[var(--gold)] mb-6">
            SKILLS TRANSLATION ENGINE
          </span>
          <h1 className="font-heading text-5xl md:text-7xl text-white tracking-wide mb-6">
            WHAT'S YOUR MOS WORTH?
          </h1>
          <p className="text-lg text-[var(--sand-dark)] max-w-2xl mx-auto leading-relaxed">
            Enter your Military Occupational Specialty code and see exactly which civilian careers match your real-world skills — with salary data and confidence scores.
          </p>
        </div>
      </section>

      {/* Search Bar */}
      <section className="relative -mt-8 z-10 max-w-3xl mx-auto px-6">
        <div className="bg-white border border-[var(--sand-dark)] rounded-sm shadow-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="mos-select" className="block text-xs font-semibold tracking-wider text-[var(--muted-foreground)] mb-2">
                SELECT YOUR MOS CODE
              </label>
              <select
                id="mos-select"
                value={selectedMOS}
                onChange={(e) => setSelectedMOS(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--sand-dark)] rounded-sm bg-[var(--cream)] text-[var(--navy)] font-medium text-lg focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:border-transparent cursor-pointer"
              >
                <option value="">Choose your MOS...</option>
                {mosCodes.map(mos => (
                  <option key={mos.code} value={mos.code}>
                    {mos.code} — {mos.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleTranslate}
                disabled={!selectedMOS || loading}
                className="w-full sm:w-auto bg-[var(--navy)] text-white font-semibold px-8 py-3 rounded-sm hover:bg-[var(--navy-light)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Translating...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 9L8 13L14 5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Translate
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="py-16 max-w-6xl mx-auto px-6">
        {result && (
          <div className="animate-scale-in">
            {/* MOS Summary */}
            <div className="mb-10 p-8 bg-[var(--navy)] rounded-sm text-white">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <span className="font-heading text-sm tracking-[0.3em] text-[var(--gold)]">YOUR MOS</span>
                  <h2 className="font-heading text-4xl md:text-5xl tracking-wide mt-2">
                    {result.mos.code} — {result.mos.title.toUpperCase()}
                  </h2>
                  <p className="text-[var(--sand-dark)] mt-3 max-w-2xl leading-relaxed">
                    {result.mos.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-heading text-5xl text-[var(--gold)]">{result.roles.length}</div>
                  <div className="text-sm text-[var(--sand-dark)]">career matches found</div>
                </div>
              </div>
            </div>

            {/* Role Cards */}
            <div className="space-y-6">
              {result.roles.map((role, i) => (
                <div
                  key={role.onet_code}
                  className="animate-fade-in-up bg-white border border-[var(--sand-dark)] rounded-sm p-8 hover:border-[var(--gold)] hover:shadow-lg transition-all group"
                  style={{ animationDelay: `${0.1 * i}s` }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Match Score */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="36" fill="none" stroke="var(--sand-dark)" strokeWidth="6" />
                          <circle
                            cx="40" cy="40" r="36" fill="none"
                            stroke={role.match_score >= 90 ? '#10b981' : role.match_score >= 80 ? 'var(--gold)' : '#f59e0b'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${(role.match_score / 100) * 226} 226`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-heading text-2xl text-[var(--navy)]">{role.match_score}%</span>
                        </div>
                      </div>
                      <span className={`mt-2 text-xs font-semibold px-2 py-1 rounded-sm text-white ${getScoreColor(role.match_score)}`}>
                        {getScoreLabel(role.match_score)}
                      </span>
                    </div>

                    {/* Role Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <span className="inline-block text-xs font-semibold tracking-wider text-[var(--gold-dark)] bg-[var(--gold)]/10 px-3 py-1 rounded-sm mb-2">
                            {role.sector.toUpperCase()}
                          </span>
                          <h3 className="font-heading text-2xl md:text-3xl tracking-wider text-[var(--navy)]">
                            {role.title.toUpperCase()}
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="font-heading text-2xl text-[var(--navy)]">
                            {formatSalary(role.salary_min)} – {formatSalary(role.salary_max)}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">annual salary range</div>
                        </div>
                      </div>

                      <p className="text-[var(--muted-foreground)] mt-3 leading-relaxed">
                        {role.description}
                      </p>

                      {/* Transferable Skills */}
                      <div className="mt-4">
                        <span className="text-xs font-semibold tracking-wider text-[var(--navy)] block mb-2">
                          YOUR TRANSFERABLE SKILLS
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {role.transferable_skills.map(skill => (
                            <span
                              key={skill}
                              className="text-xs bg-[var(--sand)] text-[var(--navy)] px-3 py-1.5 rounded-sm border border-[var(--sand-dark)] font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-[var(--muted-foreground)]">
                        O*NET Code: {role.onet_code}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-[var(--sand)] rounded-full mb-6">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--navy)" strokeWidth="1.5">
                <path d="M8 20h10M22 12v16M32 20H22" strokeLinecap="round" />
                <circle cx="20" cy="20" r="16" />
              </svg>
            </div>
            <h3 className="font-heading text-3xl text-[var(--navy)] tracking-wide mb-3">
              SELECT YOUR MOS CODE ABOVE
            </h3>
            <p className="text-[var(--muted-foreground)] max-w-md mx-auto">
              Choose your Military Occupational Specialty and we'll show you exactly which civilian careers match your experience.
            </p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
