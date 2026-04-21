import { useState } from 'react'

// Shape the backend returns at POST /api/employer/linkedin/extract.
// The frontend consumes `profile` into form fields; `source` drives the
// "Imported from LinkedIn URL" / "Imported from pasted text" banner.
//
// website_url / company_size / founded_year are optional — older server
// builds and low-signal extractions leave them off. Keeping them optional
// means the form gracefully falls back to blank when the AI can't read
// them rather than trampling existing values with empty strings.
export interface LinkedInProfile {
  company_name: string
  sector: string
  location: string
  description: string
  tagline: string
  industry_raw: string
  website_url?: string
  company_size?: string
  founded_year?: number
}

interface ExtractResponse {
  profile: LinkedInProfile
  source: 'url' | 'text'
}

interface Props {
  /**
   * Called with the extracted profile so the parent form can drop the
   * values into its state. The parent decides which fields to overwrite
   * vs. preserve — we don't do any merging here.
   */
  onImported: (profile: LinkedInProfile, source: 'url' | 'text') => void

  /**
   * Optional — the list of sectors the parent form supports. Passed down
   * so we can warn the employer if Claude returned a sector that doesn't
   * match the form's dropdown. Kept optional so this component is drop-in
   * anywhere the parent has its own SECTORS list.
   */
  sectorOptions?: readonly string[]
}

// LinkedInImportSection is the collapsible "Import from LinkedIn" panel
// we drop onto the employer registration and profile-edit forms. It
// handles both input paths (URL fetch and paste fallback) and hides
// itself behind a small chip until the employer opts in — the form
// works fine without it, and we don't want to dominate the page.
export default function LinkedInImportSection({ onImported, sectorOptions }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // showPasteFallback gets flipped on when a URL attempt fails in a way
  // where pasting is the natural next step (LinkedIn blocked us, fetch
  // errored, etc). We keep it separate from `open` so once the employer
  // has surfaced the textarea we don't collapse it on them.
  const [showPasteFallback, setShowPasteFallback] = useState(false)

  async function submit(body: { url?: string; text?: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/employer/linkedin/extract', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        setError((data as { error?: string }).error || `Request failed (${res.status})`)
        // 422 is our "we need paste fallback" signal — reveal the textarea
        // so the next attempt has a natural home. Same for 502 (unreachable).
        if (res.status === 422 || res.status === 502) {
          setShowPasteFallback(true)
        }
        return null
      }
      return data as ExtractResponse
    } catch {
      setError('Something went wrong. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleUrlImport() {
    if (!url.trim()) {
      setError('Paste a LinkedIn company URL.')
      return
    }
    const result = await submit({ url: url.trim() })
    if (result) {
      maybeWarnAboutSector(result.profile.sector)
      onImported(result.profile, result.source)
    }
  }

  async function handleTextImport() {
    if (!text.trim()) {
      setError('Paste some company text so we have something to read.')
      return
    }
    const result = await submit({ text: text.trim() })
    if (result) {
      maybeWarnAboutSector(result.profile.sector)
      onImported(result.profile, result.source)
    }
  }

  /** If Claude picked a sector we don't offer, the dropdown will stay on
   *  its placeholder after import. Flagging that to the employer up front
   *  prevents a "why didn't the sector get filled?" moment. */
  function maybeWarnAboutSector(sector: string) {
    if (!sector || !sectorOptions) return
    if (!sectorOptions.includes(sector)) {
      // soft warning only — doesn't block the import
      setError(
        `We picked "${sector}" as the sector, but that's not one of the options. Choose the closest fit below.`,
      )
    }
  }

  // Collapsed state: a single chip + tagline so the form isn't cluttered.
  if (!open) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group w-full text-left bg-white border border-dashed border-[var(--sand-dark)] rounded-sm p-4 hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all cursor-pointer flex items-center gap-3"
        >
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-[var(--navy)] text-[var(--gold)] flex-shrink-0 group-hover:bg-[var(--gold)] group-hover:text-[var(--navy)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-heading text-sm tracking-wider text-[var(--navy)]">
              IMPORT FROM LINKEDIN
            </span>
            <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
              Paste your company page URL or About section — we'll pre-fill the form.
            </span>
          </span>
          <span className="text-sm text-[var(--gold-dark)] font-semibold whitespace-nowrap">Use →</span>
        </button>
      </div>
    )
  }

  // Expanded state: URL input + paste fallback textarea. The fallback is
  // always visible once the employer opens the panel — they're already
  // here to import, and hiding one of the two input paths would just mean
  // an extra click for the people who know LinkedIn will block the fetch.
  return (
    <div className="mb-6 bg-white border border-[var(--sand-dark)] rounded-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-[var(--navy)] text-[var(--gold)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </span>
          <h3 className="font-heading text-sm tracking-wider text-[var(--navy)]">IMPORT FROM LINKEDIN</h3>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setShowPasteFallback(false) }}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer bg-transparent border-none"
        >
          Hide
        </button>
      </div>

      {/* URL input — the happy path */}
      <div>
        <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
          LINKEDIN COMPANY URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.linkedin.com/company/your-company/"
            className="flex-1 px-3 py-2 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors text-sm"
          />
          <button
            type="button"
            onClick={handleUrlImport}
            disabled={loading || !url.trim()}
            className="bg-[var(--navy)] text-white font-semibold px-5 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Reading...' : 'Fetch'}
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          LinkedIn blocks some pages from being read directly. If that happens, use the paste box below.
        </p>
      </div>

      {/* Paste fallback — always visible once expanded */}
      <div className={`mt-4 ${showPasteFallback ? 'ring-1 ring-[var(--gold)]/40 bg-[var(--gold)]/5 rounded-sm p-3 -m-3' : ''}`}>
        <label className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5">
          OR PASTE THE ABOUT SECTION
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Paste your company's About / Overview text from LinkedIn."
          className="w-full px-3 py-2 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors text-sm resize-none"
        />
        <button
          type="button"
          onClick={handleTextImport}
          disabled={loading || !text.trim()}
          className="mt-2 bg-[var(--navy)] text-white font-semibold px-5 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Reading...' : 'Extract from text'}
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-sm">
          {error}
        </div>
      )}

      <p className="mt-4 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Your input is sent to our AI to pull out the company name, sector, location, and description.
        Nothing is saved until you click <strong>Save</strong>.
      </p>
    </div>
  )
}
