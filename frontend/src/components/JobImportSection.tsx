import { useEffect, useState } from 'react'

// Shape returned by POST /api/employer/jobs/import.
interface JobDraft {
  title: string
  description: string
  requirements: string[]
  tasks: string[]
  benefits: string[]
  location: string
  salary_min: number
  salary_max: number
  employment_type: string
  mos_codes_preferred: string[]
  wotc_eligible: boolean
  civilian_role_id: number | null
  civilian_role_reason?: string
}

interface ImportResponse {
  drafts: JobDraft[]
  source: 'url' | 'text'
  count: number
}

// Mirror of the backend civilian_roles catalog shape. We fetch it once
// when the panel opens so the role-picker dropdown on each draft card
// has real options; also used to pre-validate the id Claude picked.
interface CivilianRole {
  id: number
  onet_code: string
  title: string
  sector: string
}

interface Props {
  /**
   * Called after a draft is successfully published against
   * POST /api/employer/listings so the dashboard can refresh its
   * listings table / stats. Called once per published listing.
   */
  onPublished?: () => void
}

// Draft with a client-side stable id so React can key editable rows
// even as the user edits fields. Also lets us drop individual drafts
// without relying on index (which changes when Publish removes one).
interface EditableDraft extends JobDraft {
  _localId: string
}

/**
 * JobImportSection is the employer-facing "paste a careers-page URL OR
 * paste raw job descriptions, get extracted drafts, review & publish"
 * panel. Lives on the employer dashboard above the listings table so
 * new employers can go from zero to 10 published roles in a minute.
 *
 * Same shape as LinkedInImportSection:
 *   - Collapsed: single chip.
 *   - Expanded: URL input + always-visible paste textarea fallback.
 *   - Result: list of editable draft cards with per-card Publish + a
 *     bulk "Publish all" button.
 */
export default function JobImportSection({ onPublished }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState<null | { source: 'url' | 'text'; count: number }>(null)
  // Revealed when the URL path fails in a way that expects the user to
  // paste. Kept separate from `open` so once the textarea is shown, it
  // stays shown through retries.
  const [showPasteFallback, setShowPasteFallback] = useState(false)
  const [drafts, setDrafts] = useState<EditableDraft[]>([])
  const [catalog, setCatalog] = useState<CivilianRole[]>([])
  const [publishing, setPublishing] = useState<Set<string>>(new Set())
  // Drafts that have been successfully published so the UI can grey
  // them out and show a ✓ without losing their content.
  const [published, setPublished] = useState<Set<string>>(new Set())

  // Fetch the civilian-role catalog on first expand. The endpoint is
  // public; cheap enough to refresh every time the panel opens without
  // a caching layer.
  useEffect(() => {
    if (!open) return
    if (catalog.length > 0) return
    fetch('/api/civilian-roles', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setCatalog(data.roles || []))
      .catch(() => {
        // Silent — the dropdown falls back to a raw number input. The
        // backend also validates the id before persisting.
      })
  }, [open, catalog.length])

  // importFromServer runs the POST against the backend. `body` is one
  // of { url } or { text }; on the rare case the caller sends both,
  // backend tries URL first and falls back.
  async function importFromServer(body: { url?: string; text?: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/employer/jobs/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        setError((data as { error?: string }).error || `Request failed (${res.status})`)
        if (res.status === 422 || res.status === 502) {
          setShowPasteFallback(true)
        }
        return null
      }
      return data as ImportResponse
    } catch {
      setError('Something went wrong. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleUrlImport() {
    if (!url.trim()) {
      setError('Paste a careers-page URL to import from.')
      return
    }
    const result = await importFromServer({ url: url.trim() })
    if (result) acceptResult(result)
  }

  async function handleTextImport() {
    if (!text.trim()) {
      setError('Paste the job listings so we have something to read.')
      return
    }
    const result = await importFromServer({ text: text.trim() })
    if (result) acceptResult(result)
  }

  function acceptResult(result: ImportResponse) {
    // Append (not replace) so an employer can run a second import
    // against a different URL and combine drafts. New drafts get fresh
    // local IDs; existing ones keep their edits.
    const editable: EditableDraft[] = result.drafts.map((d, i) => ({
      ...d,
      _localId: `d-${Date.now()}-${i}`,
    }))
    setDrafts(prev => [...prev, ...editable])
    setBanner({ source: result.source, count: result.drafts.length })
  }

  function updateDraft(localId: string, patch: Partial<JobDraft>) {
    setDrafts(prev => prev.map(d => (d._localId === localId ? { ...d, ...patch } : d)))
  }

  function removeDraft(localId: string) {
    setDrafts(prev => prev.filter(d => d._localId !== localId))
  }

  async function publishOne(draft: EditableDraft): Promise<boolean> {
    if (!draft.civilian_role_id) {
      setError(`Pick a civilian role for "${draft.title || 'Untitled'}" before publishing.`)
      return false
    }
    setPublishing(prev => new Set(prev).add(draft._localId))
    try {
      const res = await fetch('/api/employer/listings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          civilian_role_id: draft.civilian_role_id,
          title: draft.title,
          description: draft.description,
          requirements: draft.requirements,
          tasks: draft.tasks,
          benefits: draft.benefits,
          location: draft.location,
          salary_min: draft.salary_min,
          salary_max: draft.salary_max,
          employment_type: draft.employment_type || 'full-time',
          wotc_eligible: draft.wotc_eligible,
          mos_codes_preferred: draft.mos_codes_preferred,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(`"${draft.title}": ${data.error || res.statusText}`)
        return false
      }
      setPublished(prev => new Set(prev).add(draft._localId))
      setError('')
      onPublished?.()
      return true
    } finally {
      setPublishing(prev => {
        const next = new Set(prev)
        next.delete(draft._localId)
        return next
      })
    }
  }

  async function publishAll() {
    // Sequential publish is fine for the demo — typical import is <10
    // drafts and per-call latency is ~100ms. A batch endpoint can land
    // later if usage proves otherwise.
    for (const d of drafts) {
      if (published.has(d._localId)) continue
      const ok = await publishOne(d)
      if (!ok) break
    }
  }

  // Collapsed state — single chip, doesn't clutter the dashboard until
  // the employer opts in.
  if (!open) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group w-full text-left bg-white border border-dashed border-[var(--sand-dark)] rounded-sm p-4 hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all cursor-pointer flex items-center gap-3"
        >
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-[var(--navy)] text-[var(--gold)] flex-shrink-0 group-hover:bg-[var(--gold)] group-hover:text-[var(--navy)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5v14M9 3v14M15 5v14M21 3v14" strokeLinecap="round" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-heading text-sm tracking-wider text-[var(--navy)]">
              BULK IMPORT JOBS FROM YOUR CAREERS PAGE
            </span>
            <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
              Paste a careers-page URL or your job listings — AI extracts roles, you review, one-click publish.
            </span>
          </span>
          <span className="text-sm text-[var(--gold-dark)] font-semibold whitespace-nowrap">Use →</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 bg-white border border-[var(--sand-dark)] rounded-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-[var(--navy)] text-[var(--gold)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 5v14M9 3v14M15 5v14M21 3v14" strokeLinecap="round" />
            </svg>
          </span>
          <h3 className="font-heading text-sm tracking-wider text-[var(--navy)]">BULK IMPORT JOBS</h3>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setShowPasteFallback(false) }}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer bg-transparent border-none"
        >
          Hide
        </button>
      </div>

      {/* URL path */}
      <div>
        <label
          htmlFor="jobimport-url"
          className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5"
        >
          CAREERS PAGE URL
        </label>
        <div className="flex gap-2">
          <input
            id="jobimport-url"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://careers.your-company.com/"
            className="flex-1 px-3 py-2 border border-[var(--sand-dark)] rounded-sm bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)] transition-colors text-sm"
          />
          <button
            type="button"
            onClick={handleUrlImport}
            disabled={loading || !url.trim()}
            className="bg-[var(--navy)] text-white font-semibold px-5 py-2 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Reading...' : 'Extract'}
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          We fetch the public page and ask Claude to pull out every job posting. If the page is SPA-rendered or
          behind a login, we'll prompt you to paste below.
        </p>
      </div>

      {/* Paste fallback — always visible once expanded */}
      <div className={`mt-4 ${showPasteFallback ? 'ring-1 ring-[var(--gold)]/40 bg-[var(--gold)]/5 rounded-sm p-3 -m-3' : ''}`}>
        <label
          htmlFor="jobimport-text"
          className="block text-xs font-semibold tracking-wider text-[var(--navy)] mb-1.5"
        >
          OR PASTE JOB LISTINGS
        </label>
        <textarea
          id="jobimport-text"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          placeholder={`Paste one or more job descriptions here. Example:\n\nFleet Operations Manager — Houston, TX\nOversee fleet of 80+ vehicles...\n\nCDL Driver — Odessa, TX\nTransport oversize drilling equipment...`}
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

      {banner && (
        <div className="mt-4 bg-[var(--navy)]/5 border border-[var(--navy)]/20 text-[var(--navy)] px-4 py-3 rounded-sm text-sm">
          <strong>{banner.count}</strong> {banner.count === 1 ? 'role' : 'roles'} extracted
          {banner.source === 'url' ? ' from the URL' : ' from the pasted text'}. Review below and publish.
        </div>
      )}

      {/* Draft cards */}
      {drafts.length > 0 && (
        <div className="mt-6 border-t border-[var(--sand-dark)] pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-heading text-sm tracking-widest text-[var(--gold-dark)]">
              DRAFTS ({drafts.length - published.size} PENDING)
            </h4>
            <button
              type="button"
              onClick={publishAll}
              disabled={drafts.every(d => published.has(d._localId)) || publishing.size > 0}
              className="bg-[var(--gold)] text-[var(--navy-dark)] font-semibold text-xs px-4 py-2 rounded-sm hover:bg-[var(--gold-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Publish all
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map(draft => (
              <DraftCard
                key={draft._localId}
                draft={draft}
                catalog={catalog}
                isPublishing={publishing.has(draft._localId)}
                isPublished={published.has(draft._localId)}
                onUpdate={patch => updateDraft(draft._localId, patch)}
                onRemove={() => removeDraft(draft._localId)}
                onPublish={() => publishOne(draft)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Your input is sent to our AI to extract structured job data. Nothing is saved until you click
        <strong> Publish </strong> on each draft — so you can edit, delete, or discard freely.
      </p>
    </div>
  )
}

// --- DraftCard ---

interface DraftCardProps {
  draft: EditableDraft
  catalog: CivilianRole[]
  isPublishing: boolean
  isPublished: boolean
  onUpdate: (patch: Partial<JobDraft>) => void
  onRemove: () => void
  onPublish: () => void
}

function DraftCard({ draft, catalog, isPublishing, isPublished, onUpdate, onRemove, onPublish }: DraftCardProps) {
  // Toggle the expanded editor — the collapsed state shows just title +
  // location + publish, which is often enough for demo-speed publish.
  const [expanded, setExpanded] = useState(false)

  const pickedRole = catalog.find(r => r.id === draft.civilian_role_id)
  const needsRolePick = !draft.civilian_role_id

  return (
    <div
      className={`border rounded-sm p-4 ${
        isPublished
          ? 'bg-green-50 border-green-200 opacity-75'
          : needsRolePick
            ? 'bg-[var(--sand)]/50 border-[var(--gold)]/50'
            : 'bg-white border-[var(--sand-dark)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isPublished && (
            <div className="text-xs font-semibold tracking-wider text-green-700 mb-1">
              ✓ PUBLISHED
            </div>
          )}
          <input
            type="text"
            value={draft.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Job title"
            disabled={isPublished}
            className="w-full font-heading text-base tracking-wider text-[var(--navy)] bg-transparent border-0 border-b border-transparent hover:border-[var(--sand-dark)] focus:border-[var(--navy)] focus:outline-none py-0.5"
          />
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
            <input
              type="text"
              value={draft.location}
              onChange={e => onUpdate({ location: e.target.value })}
              placeholder="City, ST"
              disabled={isPublished}
              className="bg-transparent border-0 focus:outline-none focus:border-b focus:border-[var(--navy)] py-0.5 min-w-0 w-32"
            />
            <span>·</span>
            <input
              type="number"
              value={draft.salary_min || ''}
              onChange={e => onUpdate({ salary_min: parseInt(e.target.value, 10) || 0 })}
              placeholder="min"
              disabled={isPublished}
              className="bg-transparent border-0 focus:outline-none focus:border-b focus:border-[var(--navy)] py-0.5 w-16 text-right"
            />
            <span>–</span>
            <input
              type="number"
              value={draft.salary_max || ''}
              onChange={e => onUpdate({ salary_max: parseInt(e.target.value, 10) || 0 })}
              placeholder="max"
              disabled={isPublished}
              className="bg-transparent border-0 focus:outline-none focus:border-b focus:border-[var(--navy)] py-0.5 w-16"
            />
            <span className="text-[10px]">USD/yr</span>
            {draft.wotc_eligible && (
              <>
                <span>·</span>
                <span className="text-[var(--gold-dark)] font-semibold">WOTC</span>
              </>
            )}
          </div>

          {/* Civilian role picker — surfaced prominently when null */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-[var(--navy)] whitespace-nowrap">
              CIVILIAN ROLE{needsRolePick && !isPublished ? <span className="text-red-600"> *</span> : null}
            </span>
            <select
              value={draft.civilian_role_id ?? ''}
              onChange={e => onUpdate({ civilian_role_id: e.target.value ? Number(e.target.value) : null })}
              disabled={isPublished}
              className={`text-xs px-2 py-1 border rounded-sm bg-white text-[var(--navy)] focus:outline-none ${
                needsRolePick ? 'border-[var(--gold)]' : 'border-[var(--sand-dark)]'
              }`}
            >
              <option value="">Select role...</option>
              {catalog.map(r => (
                <option key={r.id} value={r.id}>
                  {r.sector} — {r.title}
                </option>
              ))}
            </select>
            {pickedRole && !needsRolePick && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                ({pickedRole.onet_code})
              </span>
            )}
          </div>

          {/* Tasks / preview (collapsed by default to keep the list scannable) */}
          {expanded && (
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold tracking-wider text-[var(--navy)] mb-1">DESCRIPTION</label>
                <textarea
                  value={draft.description}
                  onChange={e => onUpdate({ description: e.target.value })}
                  disabled={isPublished}
                  rows={3}
                  className="w-full px-2 py-1 border border-[var(--sand-dark)] rounded-sm text-xs bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-wider text-[var(--navy)] mb-1">TASKS (comma-separated)</label>
                <input
                  type="text"
                  value={draft.tasks.join(', ')}
                  onChange={e => onUpdate({ tasks: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  disabled={isPublished}
                  className="w-full px-2 py-1 border border-[var(--sand-dark)] rounded-sm text-xs bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-wider text-[var(--navy)] mb-1">MOS CODES PREFERRED (comma-separated)</label>
                <input
                  type="text"
                  value={draft.mos_codes_preferred.join(', ')}
                  onChange={e => onUpdate({ mos_codes_preferred: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })}
                  disabled={isPublished}
                  className="w-full px-2 py-1 border border-[var(--sand-dark)] rounded-sm text-xs bg-white text-[var(--navy)] focus:outline-none focus:border-[var(--navy)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right-side actions column */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || isPublished || needsRolePick}
            className="text-xs font-semibold bg-[var(--navy)] text-white px-3 py-1.5 rounded-sm hover:bg-[var(--navy-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPublished ? '✓ Published' : isPublishing ? 'Publishing…' : 'Publish'}
          </button>
          {!isPublished && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--navy)] transition-colors cursor-pointer bg-transparent border-none"
              >
                {expanded ? 'Collapse' : 'Edit details'}
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-xs text-red-600 hover:text-red-800 transition-colors cursor-pointer bg-transparent border-none"
              >
                Discard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
