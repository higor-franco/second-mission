import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployerListingDetailPage from './EmployerListingDetailPage'

// Shared auth mock. Defaults to a logged-in employer; swap via setEmployer.
const mockEmployer = {
  id: 1,
  email: 'test@company.com',
  company_name: 'Test Corp',
  contact_name: 'Jane',
  sector: 'Energy',
  location: 'Houston, TX',
  description: 'Test company',
  is_active: true,
}

let employerState: typeof mockEmployer | null = mockEmployer

vi.mock('@/lib/employer-auth', () => ({
  useEmployerAuth: () => ({
    employer: employerState,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    updateEmployer: vi.fn(),
  }),
  EmployerAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const listingPayload = {
  id: 7,
  title: 'Field Operations Tech',
  description: 'Maintain heavy equipment in the field.',
  requirements: ['CDL A', 'Lift 50 lbs'],
  location: 'Houston, TX',
  salary_min: 55000,
  salary_max: 85000,
  employment_type: 'full-time',
  wotc_eligible: true,
  is_active: true,
  posted_at: '2026-03-15T00:00:00Z',
  tasks: ['Inspect turbines', 'Coordinate crew'],
  benefits: ['401k'],
  mos_codes_preferred: ['88M', '91B'],
  onet_code: '49-9081',
  role_title: 'Wind Turbine Technician',
  sector: 'Energy',
  civilian_role_id: 3,
}

// One candidate per funnel bucket so we can assert that bucketing works.
// The component groups 7 backend statuses into 5 UX columns; the sample
// below deliberately covers every column including the combined buckets.
const candidatesPayload = [
  { application_id: 10, status: 'interested',      match_score: 90, applied_at: '', updated_at: '', veteran_id: 1, name: 'SGT Alpha',   mos_code: '88M', rank: 'E-5', years_of_service: 5, separation_date: '', veteran_location: 'TX', journey_step: 'match' },
  { application_id: 11, status: 'introduced',      match_score: 88, applied_at: '', updated_at: '', veteran_id: 2, name: 'SGT Bravo',   mos_code: '91B', rank: 'E-5', years_of_service: 4, separation_date: '', veteran_location: 'TX', journey_step: 'match' },
  { application_id: 12, status: 'proposal_sent',   match_score: 85, applied_at: '', updated_at: '', veteran_id: 3, name: 'SGT Charlie', mos_code: '92Y', rank: 'E-6', years_of_service: 7, separation_date: '', veteran_location: 'TX', journey_step: 'match' },
  { application_id: 13, status: 'contract_signed', match_score: 82, applied_at: '', updated_at: '', veteran_id: 4, name: 'SGT Delta',   mos_code: '12B', rank: 'E-5', years_of_service: 6, separation_date: '', veteran_location: 'TX', journey_step: 'match' },
  { application_id: 14, status: 'placed',          match_score: 80, applied_at: '', updated_at: '', veteran_id: 5, name: 'SGT Echo',    mos_code: '68W', rank: 'E-5', years_of_service: 5, separation_date: '', veteran_location: 'TX', journey_step: 'place' },
]

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/employer/listings/7']}>
      <Routes>
        <Route path="/employer/listings/:id" element={<EmployerListingDetailPage />} />
        <Route path="/employer/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function mockDetailResponse() {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/employer/listings/7/candidates')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ listing: listingPayload, candidates: candidatesPayload }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

describe('EmployerListingDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    employerState = mockEmployer
    mockDetailResponse()
  })

  it('renders the listing header (title, sector, salary)', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('FIELD OPERATIONS TECH')).toBeInTheDocument()
    })
    expect(screen.getByText(/\$55K – \$85K/)).toBeInTheDocument()
    expect(screen.getByText('ENERGY')).toBeInTheDocument()
    expect(screen.getByText('WOTC')).toBeInTheDocument()
  })

  it('renders the listing details (description, tasks, requirements, MOS preferences)', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/Maintain heavy equipment in the field./)).toBeInTheDocument()
    })
    expect(screen.getByText(/Inspect turbines/)).toBeInTheDocument()
    expect(screen.getByText(/• CDL A/)).toBeInTheDocument()
    // MOS chips on the listing sidebar. Both 88M and 91B also appear on
    // candidate cards for SGT Alpha and SGT Bravo, so we assert by count.
    // The sidebar chip is what matters here — if it ever stopped rendering,
    // the count would drop to just the one candidate-card occurrence.
    expect(screen.getAllByText('88M').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('91B').length).toBeGreaterThanOrEqual(2)
  })

  it('renders 5 funnel columns and buckets each candidate into the right stage', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('SGT Alpha')).toBeInTheDocument()
    })

    // Each column label is unique on the page.
    const matchCol    = screen.getByText('MATCH').closest('div')!.parentElement!
    const interviewCol= screen.getByText('INTERVIEW').closest('div')!.parentElement!
    const proposalCol = screen.getByText('PROPOSAL').closest('div')!.parentElement!
    const contractCol = screen.getByText('CONTRACT').closest('div')!.parentElement!
    const endCol      = screen.getByText('END').closest('div')!.parentElement!

    expect(within(matchCol).getByText('SGT Alpha')).toBeInTheDocument()     // interested
    expect(within(interviewCol).getByText('SGT Bravo')).toBeInTheDocument() // introduced
    expect(within(proposalCol).getByText('SGT Charlie')).toBeInTheDocument()// proposal_sent
    expect(within(contractCol).getByText('SGT Delta')).toBeInTheDocument()  // contract_signed
    expect(within(endCol).getByText('SGT Echo')).toBeInTheDocument()        // placed
  })

  it('exposes an edit link pointing to the edit route', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('FIELD OPERATIONS TECH')).toBeInTheDocument()
    })
    const editLink = screen.getByRole('link', { name: /edit listing/i })
    expect(editLink).toHaveAttribute('href', '/employer/listings/7/edit')
  })

  it('advances a candidate one stage when the card action is clicked', async () => {
    const user = userEvent.setup()

    // Wire a PUT mock on top of the initial fetch mock so we can assert
    // the request shape AND return a sensible response. Subsequent GETs
    // still use the original mock for the listing detail.
    const putMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'introduced' }),
    })
    const originalFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && url.includes('/candidates/10/status')) {
        return putMock(url, init)
      }
      return (originalFetch as (...args: Parameters<typeof fetch>) => Promise<Response>)(url)
    })

    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('SGT Alpha')).toBeInTheDocument()
    })

    const introduceBtn = screen.getByRole('button', { name: /introduce/i })
    await user.click(introduceBtn)

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledTimes(1)
    })
    const call = putMock.mock.calls[0]
    expect(call[0]).toContain('/api/employer/candidates/10/status')
    expect(JSON.parse(call[1].body as string)).toEqual({ status: 'introduced' })
  })

  it('redirects unauthenticated visitors to /employer/login', async () => {
    employerState = null
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument()
    })
  })
})
