import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAdminAuth } from '@/lib/admin-auth'

interface PlatformStats {
  total_veterans: number
  total_employers: number
  active_listings: number
  total_applications: number
  total_placements: number
}

interface VeteranItem {
  id: number
  email: string
  name: string
  mos_code: string
  rank: string
  years_of_service: number
  separation_date: string
  location: string
  journey_step: string
  preferred_sectors: string[]
  created_at: string
}

interface EmployerItem {
  id: number
  email: string
  company_name: string
  contact_name: string
  sector: string
  location: string
  is_active: boolean
  created_at: string
}

interface ApplicationItem {
  id: number
  status: string
  match_score: number
  created_at: string
  veteran_id: number
  veteran_name: string
  veteran_email: string
  mos_code: string
  job_listing_id: number
  job_title: string
  company_name: string
}

interface ListingItem {
  id: number
  title: string
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  wotc_eligible: boolean
  is_active: boolean
  posted_at: string
  company_name: string
  role_title: string
  sector: string
}

interface ActivityItem {
  id: number
  user_type: string
  user_id: number
  session_id: string
  action: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}

interface SessionItem {
  session_id: string
  session_start: string
  session_end: string
  action_count: number
}

type Tab = 'overview' | 'veterans' | 'employers' | 'listings' | 'applications' | 'activity'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatSalary(n: number) {
  return '$' + (n / 1000).toFixed(0) + 'K'
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    interested: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    introduced: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    interviewing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    placed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  }
  return colors[status] || 'bg-white/10 text-white/50 border-white/20'
}

function journeyBadge(step: string) {
  const colors: Record<string, string> = {
    discover: 'bg-sky-500/20 text-sky-400',
    translate: 'bg-violet-500/20 text-violet-400',
    match: 'bg-amber-500/20 text-amber-400',
    place: 'bg-emerald-500/20 text-emerald-400',
  }
  return colors[step] || 'bg-white/10 text-white/50'
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    login: 'Logged in',
    register: 'Registered',
    update_profile: 'Updated profile',
    express_interest: 'Expressed interest',
    update_candidate_status: 'Updated candidate status',
    create_listing: 'Created listing',
  }
  return labels[action] || action.replace(/_/g, ' ')
}

export default function AdminDashboardPage() {
  const { admin, loading, logout } = useAdminAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [veterans, setVeterans] = useState<VeteranItem[]>([])
  const [employers, setEmployers] = useState<EmployerItem[]>([])
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [listings, setListings] = useState<ListingItem[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Activity log viewer state
  const [selectedUser, setSelectedUser] = useState<{ type: string; id: number; name: string } | null>(null)
  const [userSessions, setUserSessions] = useState<SessionItem[]>([])
  const [userActivity, setUserActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    if (!admin) return
    fetchData()
  }, [admin])

  async function fetchData() {
    setDataLoading(true)
    try {
      const [statsRes, vetsRes, empsRes, appsRes, listRes, actRes] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }),
        fetch('/api/admin/veterans', { credentials: 'include' }),
        fetch('/api/admin/employers', { credentials: 'include' }),
        fetch('/api/admin/applications', { credentials: 'include' }),
        fetch('/api/admin/listings', { credentials: 'include' }),
        fetch('/api/admin/activity', { credentials: 'include' }),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (vetsRes.ok) setVeterans(await vetsRes.json())
      if (empsRes.ok) setEmployers(await empsRes.json())
      if (appsRes.ok) setApplications(await appsRes.json())
      if (listRes.ok) setListings(await listRes.json())
      if (actRes.ok) setRecentActivity(await actRes.json())
    } catch (err) {
      console.error('Failed to load admin data', err)
    } finally {
      setDataLoading(false)
    }
  }

  async function viewUserActivity(userType: string, userId: number, userName: string) {
    setSelectedUser({ type: userType, id: userId, name: userName })
    setActivityLoading(true)
    setTab('activity')
    try {
      const [sessRes, actRes] = await Promise.all([
        fetch(`/api/admin/sessions?user_type=${userType}&user_id=${userId}&limit=10`, { credentials: 'include' }),
        fetch(`/api/admin/activity?user_type=${userType}&user_id=${userId}&sessions=10`, { credentials: 'include' }),
      ])
      if (sessRes.ok) setUserSessions(await sessRes.json())
      if (actRes.ok) setUserActivity(await actRes.json())
    } catch (err) {
      console.error('Failed to load user activity', err)
    } finally {
      setActivityLoading(false)
    }
  }

  function clearUserSelection() {
    setSelectedUser(null)
    setUserSessions([])
    setUserActivity([])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!admin) return <Navigate to="/admin/login" replace />

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '◈' },
    { key: 'veterans', label: 'Veterans', icon: '★' },
    { key: 'employers', label: 'Employers', icon: '◆' },
    { key: 'listings', label: 'Listings', icon: '▤' },
    { key: 'applications', label: 'Applications', icon: '⬡' },
    { key: 'activity', label: 'Activity Log', icon: '◉' },
  ]

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-[#161b22]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 no-underline cursor-pointer">
              <img src="/logo.png" alt="Second Mission" className="h-8 w-auto brightness-0 invert opacity-50" />
              <span className="font-heading text-lg tracking-wider text-white/50">SECOND MISSION</span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="font-heading text-lg tracking-wider text-[var(--gold)]">COMMAND CENTER</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">{admin.name}</span>
            <button
              onClick={logout}
              className="text-white/30 hover:text-white/60 text-sm cursor-pointer transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Tab navigation */}
        <nav className="flex gap-1 mb-8 border-b border-white/10 pb-px overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== 'activity') clearUserSelection() }}
              className={`px-5 py-3 text-sm font-sans font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
                tab === t.key
                  ? 'border-[var(--gold)] text-[var(--gold)]'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <span className="mr-2 opacity-60">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'overview' && <OverviewTab stats={stats} veterans={veterans} applications={applications} recentActivity={recentActivity} onViewActivity={viewUserActivity} />}
            {tab === 'veterans' && <VeteransTab veterans={veterans} onViewActivity={viewUserActivity} />}
            {tab === 'employers' && <EmployersTab employers={employers} onViewActivity={viewUserActivity} />}
            {tab === 'listings' && <ListingsTab listings={listings} />}
            {tab === 'applications' && <ApplicationsTab applications={applications} />}
            {tab === 'activity' && (
              <ActivityTab
                recentActivity={recentActivity}
                selectedUser={selectedUser}
                userSessions={userSessions}
                userActivity={userActivity}
                activityLoading={activityLoading}
                onClearSelection={clearUserSelection}
                veterans={veterans}
                employers={employers}
                onViewActivity={viewUserActivity}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// --- Overview Tab ---
function OverviewTab({ stats, veterans, applications, recentActivity, onViewActivity }: {
  stats: PlatformStats | null
  veterans: VeteranItem[]
  applications: ApplicationItem[]
  recentActivity: ActivityItem[]
  onViewActivity: (type: string, id: number, name: string) => void
}) {
  if (!stats) return null

  const statCards = [
    { label: 'Veterans', value: stats.total_veterans, icon: '★', color: 'from-sky-500/20 to-sky-500/5 border-sky-500/20' },
    { label: 'Employers', value: stats.total_employers, icon: '◆', color: 'from-violet-500/20 to-violet-500/5 border-violet-500/20' },
    { label: 'Active Listings', value: stats.active_listings, icon: '▤', color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20' },
    { label: 'Applications', value: stats.total_applications, icon: '⬡', color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20' },
    { label: 'Placements', value: stats.total_placements, icon: '✦', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20' },
  ]

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} border rounded-lg p-5`}>
            <div className="text-2xl mb-2 opacity-60">{s.icon}</div>
            <div className="font-heading text-4xl tracking-wide text-white">{s.value}</div>
            <div className="text-white/40 text-xs font-semibold uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent veterans */}
        <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
          <h3 className="font-heading text-xl tracking-wider text-white/80 mb-4">RECENT VETERANS</h3>
          <div className="space-y-3">
            {veterans.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <div className="text-sm font-medium text-white/80">{v.name || v.email}</div>
                  <div className="text-xs text-white/30">{v.mos_code || 'No MOS'} · {v.location || 'No location'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${journeyBadge(v.journey_step)}`}>
                    {v.journey_step}
                  </span>
                  <button
                    onClick={() => onViewActivity('veteran', v.id, v.name || v.email)}
                    className="text-xs text-[var(--gold)]/60 hover:text-[var(--gold)] cursor-pointer transition-colors"
                    title="View activity log"
                  >
                    ◉
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
          <h3 className="font-heading text-xl tracking-wider text-white/80 mb-4">RECENT ACTIVITY</h3>
          <div className="space-y-3">
            {recentActivity.slice(0, 8).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <div className="text-sm text-white/70">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${a.user_type === 'veteran' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                    {actionLabel(a.action)}
                  </div>
                  <div className="text-xs text-white/30">{a.user_type} #{a.user_id}</div>
                </div>
                <div className="text-xs text-white/20">{formatDateTime(a.created_at)}</div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-white/20 text-sm text-center py-4">No activity yet. Actions from veterans and employers will appear here.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent applications */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
        <h3 className="font-heading text-xl tracking-wider text-white/80 mb-4">RECENT APPLICATIONS</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left py-3 px-3">Veteran</th>
                <th className="text-left py-3 px-3">Job</th>
                <th className="text-left py-3 px-3">Employer</th>
                <th className="text-center py-3 px-3">Score</th>
                <th className="text-center py-3 px-3">Status</th>
                <th className="text-right py-3 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 10).map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3">
                    <div className="text-white/70">{a.veteran_name || a.veteran_email}</div>
                    <div className="text-white/20 text-xs">{a.mos_code}</div>
                  </td>
                  <td className="py-3 px-3 text-white/50">{a.job_title}</td>
                  <td className="py-3 px-3 text-white/50">{a.company_name}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-heading text-lg text-[var(--gold)]">{a.match_score}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded border ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-white/30 text-xs">{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Veterans Tab ---
function VeteransTab({ veterans, onViewActivity }: { veterans: VeteranItem[]; onViewActivity: (type: string, id: number, name: string) => void }) {
  const [search, setSearch] = useState('')

  const filtered = veterans.filter(v => {
    const q = search.toLowerCase()
    return !q || v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q) || v.mos_code?.toLowerCase().includes(q) || v.location?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl tracking-wider">ALL VETERANS <span className="text-white/30 text-lg">({veterans.length})</span></h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, MOS, location..."
          className="bg-[#161b22] border border-white/10 rounded px-4 py-2 text-sm text-white w-80 placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
        />
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-center py-3 px-4">MOS</th>
                <th className="text-center py-3 px-4">Rank</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-center py-3 px-4">Journey</th>
                <th className="text-right py-3 px-4">Joined</th>
                <th className="text-center py-3 px-4">Log</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-white/80 font-medium">{v.name || <span className="text-white/20 italic">Unnamed</span>}</td>
                  <td className="py-3 px-4 text-white/40">{v.email}</td>
                  <td className="py-3 px-4 text-center">
                    {v.mos_code ? (
                      <span className="bg-[var(--navy)]/40 text-sky-300 text-xs px-2 py-0.5 rounded font-mono">{v.mos_code}</span>
                    ) : <span className="text-white/15">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-white/40">{v.rank || '—'}</td>
                  <td className="py-3 px-4 text-white/40">{v.location || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${journeyBadge(v.journey_step)}`}>
                      {v.journey_step}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white/30 text-xs">{formatDate(v.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onViewActivity('veteran', v.id, v.name || v.email)}
                      className="text-[var(--gold)]/50 hover:text-[var(--gold)] cursor-pointer transition-colors text-sm"
                      title="View activity for last 10 sessions"
                    >
                      ◉
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Employers Tab ---
function EmployersTab({ employers, onViewActivity }: { employers: EmployerItem[]; onViewActivity: (type: string, id: number, name: string) => void }) {
  const [search, setSearch] = useState('')

  const filtered = employers.filter(e => {
    const q = search.toLowerCase()
    return !q || e.company_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.sector?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl tracking-wider">ALL EMPLOYERS <span className="text-white/30 text-lg">({employers.length})</span></h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by company, email, sector..."
          className="bg-[#161b22] border border-white/10 rounded px-4 py-2 text-sm text-white w-80 placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
        />
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Company</th>
                <th className="text-left py-3 px-4">Contact</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Sector</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Joined</th>
                <th className="text-center py-3 px-4">Log</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-white/80 font-medium">{e.company_name}</td>
                  <td className="py-3 px-4 text-white/50">{e.contact_name || '—'}</td>
                  <td className="py-3 px-4 text-white/40">{e.email}</td>
                  <td className="py-3 px-4 text-white/40">{e.sector || '—'}</td>
                  <td className="py-3 px-4 text-white/40">{e.location || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${e.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {e.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white/30 text-xs">{formatDate(e.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onViewActivity('employer', e.id, e.company_name)}
                      className="text-[var(--gold)]/50 hover:text-[var(--gold)] cursor-pointer transition-colors text-sm"
                      title="View activity for last 10 sessions"
                    >
                      ◉
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Listings Tab ---
function ListingsTab({ listings }: { listings: ListingItem[] }) {
  const [search, setSearch] = useState('')

  const filtered = listings.filter(l => {
    const q = search.toLowerCase()
    return !q || l.title.toLowerCase().includes(q) || l.company_name.toLowerCase().includes(q) || l.sector?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl tracking-wider">ALL LISTINGS <span className="text-white/30 text-lg">({listings.length})</span></h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, company, sector..."
          className="bg-[#161b22] border border-white/10 rounded px-4 py-2 text-sm text-white w-80 placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
        />
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Title</th>
                <th className="text-left py-3 px-4">Employer</th>
                <th className="text-left py-3 px-4">Sector</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-center py-3 px-4">Salary</th>
                <th className="text-center py-3 px-4">WOTC</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Posted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-white/80 font-medium">{l.title}</td>
                  <td className="py-3 px-4 text-white/50">{l.company_name}</td>
                  <td className="py-3 px-4 text-white/40">{l.sector}</td>
                  <td className="py-3 px-4 text-white/40">{l.location}</td>
                  <td className="py-3 px-4 text-center text-white/50">{formatSalary(l.salary_min)}–{formatSalary(l.salary_max)}</td>
                  <td className="py-3 px-4 text-center">
                    {l.wotc_eligible ? <span className="text-emerald-400">✓</span> : <span className="text-white/15">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${l.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white/30 text-xs">{formatDate(l.posted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Applications Tab ---
function ApplicationsTab({ applications }: { applications: ApplicationItem[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? applications : applications.filter(a => a.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl tracking-wider">ALL APPLICATIONS <span className="text-white/30 text-lg">({applications.length})</span></h2>
        <div className="flex gap-2">
          {['all', 'interested', 'introduced', 'interviewing', 'placed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded cursor-pointer transition-colors border ${
                filter === s
                  ? 'border-[var(--gold)]/50 text-[var(--gold)] bg-[var(--gold)]/10'
                  : 'border-white/10 text-white/30 hover:text-white/50'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Veteran</th>
                <th className="text-left py-3 px-4">MOS</th>
                <th className="text-left py-3 px-4">Job</th>
                <th className="text-left py-3 px-4">Employer</th>
                <th className="text-center py-3 px-4">Score</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="text-white/80 font-medium">{a.veteran_name || a.veteran_email}</div>
                  </td>
                  <td className="py-3 px-4">
                    {a.mos_code ? (
                      <span className="bg-[var(--navy)]/40 text-sky-300 text-xs px-2 py-0.5 rounded font-mono">{a.mos_code}</span>
                    ) : <span className="text-white/15">—</span>}
                  </td>
                  <td className="py-3 px-4 text-white/50">{a.job_title}</td>
                  <td className="py-3 px-4 text-white/50">{a.company_name}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-heading text-lg text-[var(--gold)]">{a.match_score}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded border ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white/30 text-xs">{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Activity Tab ---
function ActivityTab({ recentActivity, selectedUser, userSessions, userActivity, activityLoading, onClearSelection, veterans, employers, onViewActivity }: {
  recentActivity: ActivityItem[]
  selectedUser: { type: string; id: number; name: string } | null
  userSessions: SessionItem[]
  userActivity: ActivityItem[]
  activityLoading: boolean
  onClearSelection: () => void
  veterans: VeteranItem[]
  employers: EmployerItem[]
  onViewActivity: (type: string, id: number, name: string) => void
}) {
  if (selectedUser) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onClearSelection}
            className="text-white/30 hover:text-white/60 cursor-pointer transition-colors text-sm"
          >
            ← Back to all activity
          </button>
          <h2 className="font-heading text-2xl tracking-wider">
            ACTIVITY LOG: <span className="text-[var(--gold)]">{selectedUser.name}</span>
            <span className="text-white/30 text-sm ml-3 font-sans font-normal">
              ({selectedUser.type} #{selectedUser.id} · Last 10 sessions)
            </span>
          </h2>
        </div>

        {activityLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sessions summary */}
            <div className="lg:col-span-1">
              <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
                <h3 className="font-heading text-lg tracking-wider text-white/60 mb-4">SESSIONS ({userSessions.length})</h3>
                {userSessions.length === 0 ? (
                  <p className="text-white/20 text-sm">No sessions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {userSessions.map((s, i) => (
                      <div key={s.session_id || i} className="p-3 bg-white/[0.02] border border-white/5 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-white/20">{s.session_id?.slice(0, 12)}...</span>
                          <span className="text-xs bg-[var(--gold)]/10 text-[var(--gold)] px-2 py-0.5 rounded">
                            {s.action_count} actions
                          </span>
                        </div>
                        <div className="text-xs text-white/40">
                          {formatDateTime(s.session_start)} → {formatDateTime(s.session_end)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Activity timeline */}
            <div className="lg:col-span-2">
              <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
                <h3 className="font-heading text-lg tracking-wider text-white/60 mb-4">ACTIONS ({userActivity.length})</h3>
                {userActivity.length === 0 ? (
                  <p className="text-white/20 text-sm">No activity recorded yet. Actions will appear here as the user interacts with the platform.</p>
                ) : (
                  <div className="space-y-2">
                    {userActivity.map(a => (
                      <div key={a.id} className="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${a.user_type === 'veteran' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-white/70 font-medium">{actionLabel(a.action)}</span>
                            <span className="text-xs text-white/15 font-mono">{a.session_id?.slice(0, 8)}</span>
                          </div>
                          {a.details && Object.keys(a.details).length > 0 && (
                            <div className="mt-1 text-xs text-white/25 font-mono">
                              {Object.entries(a.details).map(([k, v]) => (
                                <span key={k} className="mr-3">{k}: {String(v)}</span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-white/15 mt-1">
                            {formatDateTime(a.created_at)}
                            {a.ip_address && <span className="ml-3">IP: {a.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Default: show all recent activity with a user picker
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl tracking-wider">PLATFORM ACTIVITY</h2>
        <p className="text-white/30 text-sm">Click ◉ on any veteran or employer to see their last 10 sessions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick user picker */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#161b22] border border-white/10 rounded-lg p-5">
            <h3 className="font-heading text-sm tracking-wider text-white/40 mb-3">VETERANS</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {veterans.map(v => (
                <button
                  key={v.id}
                  onClick={() => onViewActivity('veteran', v.id, v.name || v.email)}
                  className="w-full text-left px-3 py-2 rounded text-sm text-white/50 hover:text-white/80 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{v.name || v.email}</span>
                  <span className="text-[var(--gold)]/40 text-xs ml-2">◉</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#161b22] border border-white/10 rounded-lg p-5">
            <h3 className="font-heading text-sm tracking-wider text-white/40 mb-3">EMPLOYERS</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {employers.map(e => (
                <button
                  key={e.id}
                  onClick={() => onViewActivity('employer', e.id, e.company_name)}
                  className="w-full text-left px-3 py-2 rounded text-sm text-white/50 hover:text-white/80 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{e.company_name}</span>
                  <span className="text-[var(--gold)]/40 text-xs ml-2">◉</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent global activity */}
        <div className="lg:col-span-2">
          <div className="bg-[#161b22] border border-white/10 rounded-lg p-6">
            <h3 className="font-heading text-lg tracking-wider text-white/60 mb-4">RECENT ACTIONS</h3>
            {recentActivity.length === 0 ? (
              <p className="text-white/20 text-sm text-center py-8">No activity yet. As veterans and employers use the platform, their actions will be logged here.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map(a => (
                  <div key={a.id} className="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${a.user_type === 'veteran' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/70 font-medium">{actionLabel(a.action)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${a.user_type === 'veteran' ? 'bg-sky-500/10 text-sky-400' : 'bg-violet-500/10 text-violet-400'}`}>
                          {a.user_type} #{a.user_id}
                        </span>
                      </div>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <div className="mt-1 text-xs text-white/25 font-mono">
                          {Object.entries(a.details).map(([k, v]) => (
                            <span key={k} className="mr-3">{k}: {String(v)}</span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-white/15 mt-1">{formatDateTime(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
