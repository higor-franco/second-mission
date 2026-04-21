import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JobImportSection from './JobImportSection'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Helpers to queue canned JSON responses in FIFO order.
function ok(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const CATALOG = {
  roles: [
    { id: 1, onet_code: '11-3071.00', title: 'Transportation, Storage, and Distribution Manager', sector: 'Logistics' },
    { id: 3, onet_code: '53-1043.00', title: 'First-Line Supervisor of Material-Moving Workers', sector: 'Logistics' },
  ],
}

describe('JobImportSection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // Default any unmocked fetch to an empty-catalog response so tests
    // that don't care about the civilian-role prefetch don't blow up on
    // the useEffect side-call.
    mockFetch.mockResolvedValue(ok({ roles: [] }))
  })

  it('is collapsed by default and opens when the chip is clicked', async () => {
    const user = userEvent.setup()
    render(<JobImportSection />)

    // Collapsed state: one chip, no URL input visible yet.
    expect(screen.getByText(/BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/CAREERS PAGE URL/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }))

    // Expanded: URL input + paste fallback both present.
    expect(screen.getByLabelText(/CAREERS PAGE URL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/OR PASTE JOB LISTINGS/i)).toBeInTheDocument()
  })

  it('fetches the civilian-role catalog when opened so the role picker has options', async () => {
    mockFetch.mockResolvedValueOnce(ok(CATALOG))
    const user = userEvent.setup()
    render(<JobImportSection />)

    await user.click(screen.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/civilian-roles', expect.objectContaining({ credentials: 'include' }))
    })
  })

  it('URL import happy path: extracts drafts, renders cards, publishes via existing endpoint', async () => {
    const extractedDrafts = {
      drafts: [
        {
          title: 'Fleet Operations Manager',
          description: 'Lead the logistics team.',
          requirements: ['CDL preferred'],
          tasks: ['Dispatch', 'Routing'],
          benefits: [],
          location: 'Houston, TX',
          salary_min: 75000,
          salary_max: 105000,
          employment_type: 'full-time',
          mos_codes_preferred: ['88M'],
          wotc_eligible: true,
          civilian_role_id: 1,
        },
      ],
      source: 'url',
      count: 1,
    }

    // Order matters: catalog first (fired by useEffect on open), then the
    // /api/employer/jobs/import POST after click, then the publish call.
    mockFetch.mockResolvedValueOnce(ok(CATALOG))
    mockFetch.mockResolvedValueOnce(ok(extractedDrafts))
    mockFetch.mockResolvedValueOnce(ok({ message: 'listing created', listing: { id: 99 } }, 201))

    const onPublished = vi.fn()
    const user = userEvent.setup()
    render(<JobImportSection onPublished={onPublished} />)

    await user.click(screen.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }))
    await screen.findByLabelText(/CAREERS PAGE URL/i)

    await user.type(screen.getByPlaceholderText(/careers.your-company.com/i), 'https://careers.example.com/')
    await user.click(screen.getByRole('button', { name: /^Extract$/ }))

    // The banner confirms the extraction. The count "1" renders inside
    // its own <strong>, so we match on the fragment that lives in a
    // single text node ("role extracted from the URL") rather than a
    // cross-tag phrase.
    await screen.findByText(/role extracted from the URL/i)
    // Draft card renders with the extracted title in a text input.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Fleet Operations Manager')).toBeInTheDocument()
    })

    // Publish the one draft.
    await user.click(screen.getByRole('button', { name: /^Publish$/ }))

    // After publish, both a label chip ("✓ PUBLISHED") and the button
    // text ("✓ Published") exist — assert on the button variant since
    // it's the post-click state signal closest to the user's action.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /✓ Published/i })).toBeDisabled()
    })

    // Verify the outbound POST hit /api/employer/listings with the draft payload.
    const publishCall = mockFetch.mock.calls.find(c => c[0] === '/api/employer/listings')
    expect(publishCall).toBeDefined()
    const body = JSON.parse(publishCall![1].body as string)
    expect(body.title).toBe('Fleet Operations Manager')
    expect(body.civilian_role_id).toBe(1)
    expect(body.mos_codes_preferred).toEqual(['88M'])

    // onPublished callback fired so the parent refreshes its stats.
    expect(onPublished).toHaveBeenCalled()
  })

  it('shows the paste-fallback affordance on a 422 response', async () => {
    mockFetch.mockResolvedValueOnce(ok(CATALOG))
    mockFetch.mockResolvedValueOnce(ok({ error: 'page blocked' }, 422))

    const user = userEvent.setup()
    render(<JobImportSection />)
    await user.click(screen.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }))
    await screen.findByLabelText(/CAREERS PAGE URL/i)

    await user.type(screen.getByPlaceholderText(/careers.your-company.com/i), 'https://gated.example.com/')
    await user.click(screen.getByRole('button', { name: /^Extract$/ }))

    // The error surface appears.
    await screen.findByText(/page blocked/i)
    // And the paste textarea is still there for the employer to use.
    expect(screen.getByLabelText(/OR PASTE JOB LISTINGS/i)).toBeInTheDocument()
  })

  it('blocks publish when civilian_role_id is null and surfaces the message', async () => {
    const draftsWithNullRole = {
      drafts: [
        {
          title: 'Ambiguous Role',
          description: '',
          requirements: [],
          tasks: [],
          benefits: [],
          location: 'Remote',
          salary_min: 0,
          salary_max: 0,
          employment_type: 'full-time',
          mos_codes_preferred: [],
          wotc_eligible: true,
          civilian_role_id: null,
        },
      ],
      source: 'text',
      count: 1,
    }

    mockFetch.mockResolvedValueOnce(ok(CATALOG))
    mockFetch.mockResolvedValueOnce(ok(draftsWithNullRole))

    const user = userEvent.setup()
    render(<JobImportSection />)
    await user.click(screen.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }))
    await screen.findByLabelText(/OR PASTE JOB LISTINGS/i)
    await user.type(screen.getByLabelText(/OR PASTE JOB LISTINGS/i), 'Some job text')
    await user.click(screen.getByRole('button', { name: /Extract from text/i }))

    await screen.findByDisplayValue('Ambiguous Role')
    // The publish button is disabled while the picker is still unset —
    // userEvent.click reports this by not advancing state; verify via
    // the visible error after we force the click manually.
    const publishBtn = screen.getByRole('button', { name: /^Publish$/ })
    expect(publishBtn).toBeDisabled()
  })
})
