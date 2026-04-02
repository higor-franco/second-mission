import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export default function Header() {
  const { veteran, loading } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--cream)]/90 backdrop-blur-md border-b border-[var(--sand-dark)]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 no-underline group cursor-pointer">
          <div className="w-10 h-10 bg-[var(--navy)] rounded-sm flex items-center justify-center group-hover:bg-[var(--navy-light)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 10L9 14L15 6" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <span className="font-heading text-2xl tracking-wider text-[var(--navy)] leading-none">
              SECOND MISSION
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/translate"
            className="text-sm font-semibold text-[var(--navy)] hover:text-[var(--gold-dark)] transition-colors cursor-pointer no-underline"
          >
            Translate Your MOS
          </Link>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer no-underline hidden md:inline"
          >
            How It Works
          </a>
          <a
            href="#careers"
            className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer no-underline hidden md:inline"
          >
            Careers
          </a>
          {!loading && (
            veteran ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-[var(--navy)] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-[var(--navy)] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
              >
                Sign In
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
