import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LinkedInImportSection, { type LinkedInProfile } from './LinkedInImportSection'

const SECTORS = [
  'Energy & Oil/Gas',
  'Construction',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Field Operations',
  'Maintenance & Repair',
  'Other',
] as const

const sampleProfile: LinkedInProfile = {
  company_name: 'NOV Inc.',
  sector: 'Energy & Oil/Gas',
  location: 'Houston, TX',
  description: 'A leading provider of oil and gas equipment.',
  tagline: '',
  industry_raw: 'Oil and Gas',
}

describe('LinkedInImportSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts collapsed and expands when the "Use" chip is clicked', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()

    render(<LinkedInImportSection onImported={onImported} />)

    // Collapsed — only the chip copy is visible, not the form inputs.
    expect(screen.getByText(/IMPORT FROM LINKEDIN/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/LINKEDIN COMPANY URL/i)).not.toBeInTheDocument()

    await user.click(screen.getByText(/Use →/i))

    // Expanded — the URL input and the paste textarea are both visible.
    expect(screen.getByText(/LINKEDIN COMPANY URL/i)).toBeInTheDocument()
    expect(screen.getByText(/OR PASTE THE ABOUT SECTION/i)).toBeInTheDocument()
  })

  it('calls onImported with the extracted profile on URL happy path', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profile: sampleProfile, source: 'url' }),
    } as Response)

    render(<LinkedInImportSection onImported={onImported} sectorOptions={SECTORS} />)
    await user.click(screen.getByText(/Use →/i))

    const urlInput = screen.getByPlaceholderText(/linkedin\.com\/company/i)
    await user.type(urlInput, 'https://www.linkedin.com/company/nov/')
    await user.click(screen.getByRole('button', { name: /Fetch/i }))

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1)
    })
    expect(onImported).toHaveBeenCalledWith(sampleProfile, 'url')

    // Body matches what the backend expects.
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('/api/employer/linkedin/extract')
    expect(JSON.parse(call[1].body)).toEqual({ url: 'https://www.linkedin.com/company/nov/' })
  })

  it('calls onImported with source="text" on the paste path', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profile: sampleProfile, source: 'text' }),
    } as Response)

    render(<LinkedInImportSection onImported={onImported} sectorOptions={SECTORS} />)
    await user.click(screen.getByText(/Use →/i))

    const textarea = screen.getByPlaceholderText(/About \/ Overview text/i)
    await user.type(textarea, 'About NOV — oil & gas equipment, headquartered in Houston.')
    await user.click(screen.getByRole('button', { name: /Extract from text/i }))

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1)
    })
    expect(onImported).toHaveBeenCalledWith(sampleProfile, 'text')
  })

  it('surfaces the server error + highlights the paste area on 422', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "LinkedIn didn't let us read that page." }),
    } as Response)

    render(<LinkedInImportSection onImported={onImported} sectorOptions={SECTORS} />)
    await user.click(screen.getByText(/Use →/i))

    const urlInput = screen.getByPlaceholderText(/linkedin\.com\/company/i)
    await user.type(urlInput, 'https://www.linkedin.com/company/whatever/')
    await user.click(screen.getByRole('button', { name: /Fetch/i }))

    await waitFor(() => {
      expect(screen.getByText(/didn't let us read/i)).toBeInTheDocument()
    })
    expect(onImported).not.toHaveBeenCalled()
  })

  it('warns when Claude picks a sector that is not in our options', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profile: { ...sampleProfile, sector: 'Biotech' },
        source: 'text',
      }),
    } as Response)

    render(<LinkedInImportSection onImported={onImported} sectorOptions={SECTORS} />)
    await user.click(screen.getByText(/Use →/i))

    const textarea = screen.getByPlaceholderText(/About \/ Overview text/i)
    await user.type(textarea, 'About BioCorp.')
    await user.click(screen.getByRole('button', { name: /Extract from text/i }))

    await waitFor(() => {
      expect(onImported).toHaveBeenCalled()
    })
    // Soft warning shown inline — doesn't block the import callback.
    expect(screen.getByText(/not one of the options/i)).toBeInTheDocument()
  })
})
