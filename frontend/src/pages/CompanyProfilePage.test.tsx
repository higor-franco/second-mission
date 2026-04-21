import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CompanyProfilePage from './CompanyProfilePage'

// Auth mock — mirror the pattern the other page tests use so we don't
// need a real AuthProvider context wired up for the render.
let mockVeteran: unknown = null
let mockLoading = false

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: mockVeteran,
    loading: mockLoading,
    logout: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

const VETERAN = {
  id: 42,
  email: 'demo-vet@secondmission.demo',
  name: 'Alex Ramirez',
  mos_code: '88M',
  rank: 'E-5',
  years_of_service: 6,
  separation_date: '2026-06-30',
  location: 'Killeen, TX',
  preferred_sectors: ['Energy', 'Logistics'],
  profile_complete: true,
  journey_step: 'match',
}

// Render the page with a route param so useParams() resolves — same
// shape as the real router entry at /companies/:id.
function renderPage(id: string | number = 1) {
  return render(
    <MemoryRouter initialEntries={[`/companies/${id}`]}>
      <Routes>
        <Route path="/companies/:id" element={<CompanyProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// Helper that resolves one fetch to a given body and status.
function mockResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

describe('CompanyProfilePage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockVeteran = VETERAN
    mockLoading = false
  })

  it('renders the company identity and contact CTAs once the fetch resolves', async () => {
    mockResponse({
      employer: {
        id: 1,
        company_name: 'NOV (National Oilwell Varco)',
        sector: 'Energy',
        location: 'Houston, TX',
        description: 'Global provider of drilling equipment and services.',
        website_url: 'https://www.nov.com',
        linkedin_url: 'https://www.linkedin.com/company/nov-inc/',
        company_size: '10,001+ employees',
        founded_year: 1862,
        is_active: true,
      },
      listings: [],
    })

    renderPage(1)

    // Company identity — the h1 is the definitive "this page is about NOV"
    // signal. Matching the heading tag also avoids clashing with the
    // h2 "ABOUT NOV..." or inline `<strong>NOV</strong>` in the empty
    // state, both of which contain the same text.
    await screen.findByRole('heading', { level: 1, name: /NOV \(National Oilwell Varco\)/i })
    expect(screen.getByText(/Houston, TX/i)).toBeInTheDocument()
    expect(screen.getByText(/10,001\+ employees/)).toBeInTheDocument()
    expect(screen.getByText(/Founded 1862/i)).toBeInTheDocument()

    // External links — the heart of "helps veterans research the employer".
    const website = screen.getByRole('link', { name: /Visit website/i })
    expect(website.getAttribute('href')).toBe('https://www.nov.com')
    expect(website.getAttribute('target')).toBe('_blank')

    const linkedin = screen.getByRole('link', { name: /LinkedIn/i })
    expect(linkedin.getAttribute('href')).toBe('https://www.linkedin.com/company/nov-inc/')
  })

  it('renders listed open roles and deep-links them to the opportunities page', async () => {
    mockResponse({
      employer: {
        id: 1,
        company_name: 'GE Vernova',
        sector: 'Energy',
        location: 'Houston, TX',
        description: '',
        website_url: '',
        linkedin_url: '',
        company_size: '',
        founded_year: 0,
        is_active: true,
      },
      listings: [
        {
          id: 10,
          title: 'Wind Turbine Service Technician',
          description: 'Service the GE Haliade-X fleet across West Texas farms.',
          requirements: [],
          location: 'Sweetwater, TX',
          salary_min: 52000,
          salary_max: 78000,
          employment_type: 'full-time',
          wotc_eligible: true,
          posted_at: '2026-04-10T12:00:00Z',
          tasks: [],
          benefits: [],
          mos_codes_preferred: [],
          onet_code: '49-9081.00',
          role_title: 'Wind Turbine Service Technician',
          sector: 'Energy',
        },
      ],
    })

    renderPage(1)

    await screen.findByText(/Wind Turbine Service Technician/i)
    expect(screen.getByText(/Sweetwater, TX/i)).toBeInTheDocument()
    expect(screen.getByText(/WOTC ELIGIBLE/i)).toBeInTheDocument()

    // "See match score →" link on each listing points back at the full
    // opportunities page where the match score is computed per veteran.
    const matchLink = screen.getByRole('link', { name: /See match score/i })
    expect(matchLink.getAttribute('href')).toBe('/opportunities')
  })

  it('shows an empty state instead of a crash when the employer has no listings', async () => {
    mockResponse({
      employer: {
        id: 1,
        company_name: 'New Employer',
        sector: '',
        location: '',
        description: '',
        website_url: '',
        linkedin_url: '',
        company_size: '',
        founded_year: 0,
        is_active: true,
      },
      listings: [],
    })

    renderPage(1)

    await screen.findByRole('heading', { level: 1, name: /New Employer/i })
    // The empty-state paragraph splits the company name into a <strong>
    // so we match a fragment that lives in a single text node.
    expect(
      screen.getByText(/No active listings from/i),
    ).toBeInTheDocument()
  })

  it('shows the error state when the API returns 404', async () => {
    mockResponse({ error: 'company not found' }, 404)

    renderPage(999)

    await waitFor(() =>
      expect(screen.getByText(/COMPANY UNAVAILABLE/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/company not found/i)).toBeInTheDocument()
  })

  it('sanitizes a non-LinkedIn URL out of the LinkedIn button', async () => {
    // Defense-in-depth — the form could hypothetically be bypassed. The
    // page must not render a LinkedIn-branded link that actually points
    // somewhere else.
    mockResponse({
      employer: {
        id: 1,
        company_name: 'Sketchy Corp',
        sector: '',
        location: '',
        description: '',
        website_url: '',
        linkedin_url: 'https://evil.example.com/redirect',
        company_size: '',
        founded_year: 0,
        is_active: true,
      },
      listings: [],
    })

    renderPage(1)

    await screen.findByRole('heading', { level: 1, name: /Sketchy Corp/i })
    expect(screen.queryByRole('link', { name: /LinkedIn/i })).not.toBeInTheDocument()
  })
})
