import { render, screen, waitFor } from '@testing-library/react'
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
})
