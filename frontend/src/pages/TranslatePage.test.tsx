import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TranslatePage from './TranslatePage'

// Mock auth context used by Header
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockMosCodes = [
  { code: '88M', title: 'Motor Transport Operator', branch: 'Army', description: 'Operates wheeled vehicles' },
  { code: '91B', title: 'Wheeled Vehicle Mechanic', branch: 'Army', description: 'Maintains vehicles' },
]

const mockTranslateResponse = {
  mos: mockMosCodes[0],
  roles: [
    {
      onet_code: '53-3032.00',
      title: 'Heavy and Tractor-Trailer Truck Driver',
      description: 'Drive a tractor-trailer combination.',
      sector: 'Transportation',
      salary_min: 42000,
      salary_max: 72000,
      match_score: 95,
      transferable_skills: ['vehicle operation', 'cargo handling'],
    },
    {
      onet_code: '11-3071.00',
      title: 'Transportation Manager',
      description: 'Plan and coordinate transportation.',
      sector: 'Logistics',
      salary_min: 72000,
      salary_max: 120000,
      match_score: 88,
      transferable_skills: ['fleet management', 'logistics coordination'],
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TranslatePage />
    </MemoryRouter>
  )
}

describe('TranslatePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the page title and MOS selector', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMosCodes,
    } as Response)

    renderPage()

    expect(screen.getByText("WHAT'S YOUR MOS WORTH?")).toBeInTheDocument()
    expect(screen.getByText('SELECT YOUR MOS CODE ABOVE')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Choose your MOS...')).toBeInTheDocument()
    })
  })

  it('loads MOS codes into the selector', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMosCodes,
    } as Response)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('88M — Motor Transport Operator')).toBeInTheDocument()
      expect(screen.getByText('91B — Wheeled Vehicle Mechanic')).toBeInTheDocument()
    })
  })

  it('shows translated roles after selecting MOS and clicking translate', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMosCodes,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslateResponse,
      } as Response)

    renderPage()

    // Wait for MOS codes to load
    await waitFor(() => {
      expect(screen.getByText('88M — Motor Transport Operator')).toBeInTheDocument()
    })

    // Select a MOS code
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '88M')

    // Click translate
    const translateButton = screen.getByRole('button', { name: /translate/i })
    await user.click(translateButton)

    // Verify results appear
    await waitFor(() => {
      expect(screen.getByText('HEAVY AND TRACTOR-TRAILER TRUCK DRIVER')).toBeInTheDocument()
      expect(screen.getByText('TRANSPORTATION MANAGER')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('88%')).toBeInTheDocument()
      expect(screen.getByText('vehicle operation')).toBeInTheDocument()
      expect(screen.getByText('fleet management')).toBeInTheDocument()
    })
  })

  it('shows error message for failed API call', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMosCodes,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'MOS code not found' }),
      } as Response)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('88M — Motor Transport Operator')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '88M')

    const translateButton = screen.getByRole('button', { name: /translate/i })
    await user.click(translateButton)

    await waitFor(() => {
      expect(screen.getByText('MOS code not found')).toBeInTheDocument()
    })
  })

  it('shows empty state when no MOS is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMosCodes,
    } as Response)

    renderPage()

    expect(screen.getByText('SELECT YOUR MOS CODE ABOVE')).toBeInTheDocument()
  })

  // ---- DD-214 upload tab ----

  const mockDD214Response = {
    profile: {
      name: 'John A. Doe',
      primary_mos: { code: '88M', title: 'Motor Transport Operator' },
      secondary_mos: [{ code: '92Y', title: 'Unit Supply Specialist' }],
      additional_skills: ['Air Assault'],
      rank: 'Staff Sergeant',
      paygrade: 'E-6',
      years_of_service: 8,
      military_education: ['Warrior Leader Course'],
      decorations: ['Army Commendation Medal'],
      branch: 'Army',
      separation_reason: 'Completion of Required Active Service',
    },
    mos_list: [
      { code: '88M', title: 'Motor Transport Operator', branch: 'Army', description: '', primary: true, found: true },
      { code: '92Y', title: 'Unit Supply Specialist', branch: 'Army', description: '', primary: false, found: true },
    ],
    roles: [
      {
        onet_code: '53-3032.00',
        title: 'Heavy and Tractor-Trailer Truck Driver',
        description: 'Drive a tractor-trailer combination.',
        sector: 'Transportation',
        salary_min: 42000,
        salary_max: 72000,
        match_score: 95,
        transferable_skills: ['vehicle operation'],
        best_mos: '88M',
      },
    ],
  }

  it('switches to the DD-214 upload tab and shows the upload UI', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMosCodes,
    } as Response)

    renderPage()
    await user.click(screen.getByRole('tab', { name: /UPLOAD MY DD-214/i }))

    expect(screen.getByText(/UPLOAD YOUR DD-214 ABOVE/i)).toBeInTheDocument()
    expect(screen.getByText(/Choose your DD-214 PDF/i)).toBeInTheDocument()
    // Disclaimer is shown
    expect(screen.getByText(/never stored/i)).toBeInTheDocument()
  })

  it('rejects non-PDF files with an inline error', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMosCodes,
    } as Response)

    renderPage()
    await user.click(screen.getByRole('tab', { name: /UPLOAD MY DD-214/i }))

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    // Use fireEvent.change so the browser accept attribute is bypassed and
    // the page's JS-level validation is exercised.
    fireEvent.change(fileInput, { target: { files: [txt] } })

    await waitFor(() => {
      expect(screen.getByText(/upload your DD-214 as a PDF/i)).toBeInTheDocument()
    })
  })

  it('uploads a DD-214 PDF and renders the extracted profile + aggregated roles', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => mockMosCodes } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDD214Response,
      } as Response)

    renderPage()
    await user.click(screen.getByRole('tab', { name: /UPLOAD MY DD-214/i }))

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const pdf = new File(['%PDF-1.4\n'], 'my-dd214.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, pdf)

    // File name visible in the button
    expect(screen.getByText('my-dd214.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Analyze with AI/i }))

    await waitFor(() => {
      expect(screen.getByText(/EXTRACTED FROM YOUR DD-214/i)).toBeInTheDocument()
      // Name as the main title.
      expect(screen.getByText('JOHN A. DOE')).toBeInTheDocument()
      // Rank · branch · years · paygrade subtitle.
      expect(
        screen.getByText(/Staff Sergeant · U\.S\. Army · 8 years of service · E-6/i),
      ).toBeInTheDocument()
      // MOS chips — 88M also appears in the role card's "best_mos" line.
      expect(screen.getAllByText(/88M/).length).toBeGreaterThan(0)
      expect(screen.getByText(/92Y/)).toBeInTheDocument()
      // Aggregated role card
      expect(screen.getByText('HEAVY AND TRACTOR-TRAILER TRUCK DRIVER')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      // Attribution to best MOS
      expect(screen.getByText(/Best match via your/i)).toBeInTheDocument()
    })
  })

  it('falls back to rank + branch header when the name is not extracted', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => mockMosCodes } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockDD214Response,
          profile: { ...mockDD214Response.profile, name: '' },
        }),
      } as Response)

    renderPage()
    await user.click(screen.getByRole('tab', { name: /UPLOAD MY DD-214/i }))

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const pdf = new File(['%PDF-1.4\n'], 'my-dd214.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, pdf)
    await user.click(screen.getByRole('button', { name: /Analyze with AI/i }))

    await waitFor(() => {
      // Falls back to the rank + branch composite title.
      expect(screen.getByText('STAFF SERGEANT, ARMY')).toBeInTheDocument()
      // Subtitle line is only rendered when we have a name, so it should NOT be there.
      expect(
        screen.queryByText(/U\.S\. Army · 8 years of service · E-6/i),
      ).not.toBeInTheDocument()
    })
  })

  it('shows a server error returned from the upload endpoint', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => mockMosCodes } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: 'we couldn\u2019t read your DD-214' }),
      } as Response)

    renderPage()
    await user.click(screen.getByRole('tab', { name: /UPLOAD MY DD-214/i }))

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const pdf = new File(['%PDF-1.4\n'], 'my-dd214.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, pdf)
    await user.click(screen.getByRole('button', { name: /Analyze with AI/i }))

    await waitFor(() => {
      expect(screen.getByText(/couldn\u2019t read your DD-214/i)).toBeInTheDocument()
    })
  })
})
