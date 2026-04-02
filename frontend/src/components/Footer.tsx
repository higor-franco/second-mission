export default function Footer() {
  return (
    <footer className="bg-[var(--navy-dark)] text-[var(--sand)] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="Second Mission" className="h-12 w-auto brightness-0 invert" />
              <span className="font-heading text-3xl tracking-wider text-white">SECOND MISSION</span>
            </div>
            <p className="text-sm text-[var(--sand-dark)] leading-relaxed max-w-xs">
              Connecting America's veterans to high-demand industrial careers. Free for veterans, always.
            </p>
          </div>
          <div>
            <h4 className="font-heading text-lg tracking-wider text-[var(--gold)] mb-4">FOR VETERANS</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/translate" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">Translate Your MOS</a></li>
              <li><a href="#careers" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">Explore Careers</a></li>
              <li><a href="#how-it-works" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">How It Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading text-lg tracking-wider text-[var(--gold)] mb-4">FOR EMPLOYERS</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/#employers" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">Why Second Mission</a></li>
              <li><a href="/employer/register" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">Create Employer Account</a></li>
              <li><a href="/employer/login" className="text-[var(--sand-dark)] hover:text-white transition-colors no-underline cursor-pointer">Employer Sign In</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-xs text-[var(--sand-dark)]">
          &copy; {new Date().getFullYear()} Second Mission. All rights reserved. A Beez Kneez project.
        </div>
      </div>
    </footer>
  )
}
