import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from './ProfilePage'

let mockVeteran: any = null

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: mockVeteran,
    loading: false,
    logout: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    updateVeteran: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function emptyVeteran() {
  return {
    id: 1,
    email: 'newbie@example.com',
    name: '',
    mos_code: '',
    rank: '',
    years_of_service: 0,
    separation_date: '',
    location: '',
    preferred_sectors: [],
    profile_complete: false,
    journey_step: 'discover',
  }
}

function filledVeteran() {
  return {
    ...emptyVeteran(),
    name: 'Jane Smith',
    mos_code: '88M',
    rank: 'E-5',
    years_of_service: 6,
    separation_date: '2023-06-15',
    location: 'Killeen, TX',
    preferred_sectors: ['Logistics'],
    profile_complete: true,
    journey_step: 'match',
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Fork phase (new veteran) ----

  it('shows the setup fork for a brand-new veteran with an empty profile', () => {
    mockVeteran = emptyVeteran()
    renderPage()

    expect(screen.getByText(/LET'S GET YOU SET UP/i)).toBeInTheDocument()
    // Primary card: DD-214 upload.
    expect(screen.getByText(/UPLOAD YOUR DD-214/i)).toBeInTheDocument()
    expect(screen.getByText(/RECOMMENDED/i)).toBeInTheDocument()
    // Secondary card: manual entry.
    expect(screen.getByText(/ENTER YOUR DETAILS MANUALLY/i)).toBeInTheDocument()
    // Form should NOT be rendered yet.
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument()
  })

  it('skips the fork and shows the form when the profile is already populated', () => {
    mockVeteran = filledVeteran()
    renderPage()

    expect(screen.queryByText(/LET'S GET YOU SET UP/i)).not.toBeInTheDocument()
    expect(screen.getByText('YOUR PROFILE')).toBeInTheDocument()
    // Form input is present and pre-populated.
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Jane Smith')
  })

  it('goes to the upload phase when the DD-214 card is clicked', async () => {
    const user = userEvent.setup()
    mockVeteran = emptyVeteran()
    renderPage()

    // The whole card is a button; match by its visible heading text.
    await user.click(screen.getByText(/UPLOAD YOUR DD-214/i).closest('button')!)

    expect(screen.getByText(/Choose your DD-214 PDF/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analyze & pre-fill profile/i })).toBeInTheDocument()
    // Form still hidden.
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument()
  })

  it('goes to the manual form when the secondary card is clicked', async () => {
    const user = userEvent.setup()
    mockVeteran = emptyVeteran()
    renderPage()

    await user.click(screen.getByText(/ENTER YOUR DETAILS MANUALLY/i).closest('button')!)

    expect(screen.getByText('YOUR PROFILE')).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement
    // Brand-new veteran → form starts blank.
    expect(nameInput.value).toBe('')
  })

  // ---- Upload phase (DD-214 import) ----

  it('imports a DD-214 and pre-fills the profile form with the AI suggestion', async () => {
    const user = userEvent.setup()
    mockVeteran = emptyVeteran()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profile: { name: 'John A. Doe', separation_date: '2023-06-15' },
        profile_suggestion: {
          name: 'John A. Doe',
          mos_code: '88M',
          rank: 'E-6',
          years_of_service: 8,
          separation_date: '2023-06-15',
          location: '',
          preferred_sectors: [],
        },
        mos_list: [
          { code: '88M', found: true },
          { code: '92Y', found: true },
        ],
        roles: [{ onet_code: '53-3032.00' }, { onet_code: '11-3071.00' }],
      }),
    } as Response)

    renderPage()
    // Enter upload phase.
    await user.click(screen.getByText(/UPLOAD YOUR DD-214/i).closest('button')!)

    // Upload a PDF.
    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const pdf = new File(['%PDF-1.4\n'], 'mine.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, pdf)
    await user.click(screen.getByRole('button', { name: /Analyze & pre-fill profile/i }))

    // We should land on the form with values filled and a success banner.
    await waitFor(() => {
      expect(screen.getByText('YOUR PROFILE')).toBeInTheDocument()
      expect(screen.getByText(/Imported from your DD-214/i)).toBeInTheDocument()
      expect(screen.getByText(/2 recognized MOS codes/i)).toBeInTheDocument()
      expect(screen.getByText(/2 civilian roles/i)).toBeInTheDocument()
    })

    expect((screen.getByLabelText(/Full Name/i) as HTMLInputElement).value).toBe('John A. Doe')
    expect((screen.getByLabelText(/MOS Code/i) as HTMLInputElement).value).toBe('88M')
    expect((screen.getByLabelText(/Rank/i) as HTMLSelectElement).value).toBe('E-6')
    expect((screen.getByLabelText(/Years of Service/i) as HTMLInputElement).value).toBe('8')
    expect((screen.getByLabelText(/Separation Date/i) as HTMLInputElement).value).toBe('2023-06-15')
  })

  it('shows the server error when DD-214 import fails', async () => {
    const user = userEvent.setup()
    mockVeteran = emptyVeteran()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: 'we couldn\u2019t read your DD-214' }),
    } as Response)

    renderPage()
    await user.click(screen.getByText(/UPLOAD YOUR DD-214/i).closest('button')!)

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const pdf = new File(['%PDF-1.4\n'], 'mine.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, pdf)
    await user.click(screen.getByRole('button', { name: /Analyze & pre-fill profile/i }))

    await waitFor(() => {
      expect(screen.getByText(/couldn\u2019t read your DD-214/i)).toBeInTheDocument()
    })
    // Form should NOT render on error — user stays in the upload phase.
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument()
  })

  it('rejects a non-PDF file in the upload phase with an inline error', async () => {
    const user = userEvent.setup()
    mockVeteran = emptyVeteran()

    renderPage()
    await user.click(screen.getByText(/UPLOAD YOUR DD-214/i).closest('button')!)

    const fileInput = document.getElementById('dd214-file') as HTMLInputElement
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [txt] } })

    await waitFor(() => {
      expect(screen.getByText(/upload your DD-214 as a PDF/i)).toBeInTheDocument()
    })
  })
})
