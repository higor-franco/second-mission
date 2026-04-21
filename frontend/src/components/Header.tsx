import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export default function Header() {
  const { veteran, loading } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--cream)]/90 backdrop-blur-md border-b border-[var(--sand-dark)]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 no-underline group cursor-pointer">
          <img src="/logo.png" alt="Second Mission" className="h-10 w-auto" />
          <span className="font-heading text-2xl tracking-wider text-[var(--navy)] leading-none">
            SECOND MISSION
          </span>
        </Link>
        <nav className="flex items-center gap-6">
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
          <a
            href="#employers"
            className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer no-underline hidden md:inline"
          >
            For Employers
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer no-underline hidden md:inline"
          >
            FAQ
          </a>
          {!loading && (
            veteran ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-[var(--navy)] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
              >
                Veteran Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-[var(--navy)] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[var(--navy-light)] transition-all cursor-pointer no-underline"
                >
                  Veteran Sign In
                </Link>
                <Link
                  to="/employer/login"
                  className="inline-flex items-center gap-2 border-2 border-[var(--navy)] text-[var(--navy)] text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[var(--navy)] hover:text-white transition-all cursor-pointer no-underline hidden md:inline-flex"
                >
                  Employer Sign In
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
