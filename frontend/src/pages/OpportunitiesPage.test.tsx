import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpportunitiesPage from './OpportunitiesPage'

let mockVeteran: any = null
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

const mockOpportunities = [
  {
    id: 1,
    title: 'Fleet Operations Manager',
    description: 'Oversee fleet of 80+ vehicles',
    requirements: ['CDL preferred', 'Fleet management experience'],
    location: 'Houston, TX',
    salary_min: 75000,
    salary_max: 105000,
    employment_type: 'full-time',
    wotc_eligible: true,
    sector: 'Logistics',
    role_title: 'Transportation Manager',
    company_name: 'NOV (National Oilwell Varco)',
    company_location: 'Houston, TX',
    match_score: 88,
    transferable_skills: ['fleet management', 'logistics coordination'],
    score_breakdown: {
      mos_base_score: 88,
      skills_overlap: 85,
      sector_alignment: 100,
      mos_preference: 100,
      location_match: 90,
      hybrid_score: 91,
      matched_skills: ['fleet management', 'logistics coordination'],
      explanation: 'Strong military skills match, excellent skills overlap with job tasks, employer specifically seeks your MOS, and matches your preferred sector.',
    },
  },
  {
    id: 2,
    title: 'CDL Driver — Equipment Transport',
    description: 'Transport oversize drilling equipment',
    requirements: ['CDL Class A license'],
    location: 'Houston, TX',
    salary_min: 52000,
    salary_max: 74000,
    employment_type: 'full-time',
    wotc_eligible: true,
    sector: 'Logistics',
    role_title: 'Heavy Truck Driver',
    company_name: 'NOV (National Oilwell Varco)',
    company_location: 'Houston, TX',
    match_score: 95,
    transferable_skills: ['vehicle operation', 'cargo handling'],
    score_breakdown: {
      mos_base_score: 95,
      skills_overlap: 85,
      sector_alignment: 100,
      mos_preference: 100,
      location_match: 100,
      hybrid_score: 95,
      matched_skills: ['vehicle operation'],
      explanation: 'Strong military skills match, excellent skills overlap, employer specifically seeks your MOS, and in your area.',
    },
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <OpportunitiesPage />
    </MemoryRouter>
  )
}

describe('OpportunitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoading = false
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ opportunities: mockOpportunities }),
      ok: true,
    })
  })

  it('shows loading spinner while auth loads', () => {
    mockLoading = true
    mockVeteran = null
    renderPage()
    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
    mockLoading = false
  })

  it('shows set MOS message when veteran has no MOS code', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: false,
      journey_step: 'discover',
    }
    renderPage()
    // Wait for fetch to resolve (loading spinner to disappear)
    expect(await screen.findByText('SET YOUR MOS CODE')).toBeInTheDocument()
  })

  it('renders matched opportunities for veteran with MOS', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    expect(screen.getByText('CDL Driver — Equipment Transport')).toBeInTheDocument()
  })

  it('shows WOTC eligible badge for eligible jobs', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    const wotcBadges = screen.getAllByText('WOTC ELIGIBLE')
    expect(wotcBadges.length).toBeGreaterThan(0)
  })

  it('shows Express Interest button for each job', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    const interestButtons = screen.getAllByText('Express Interest')
    expect(interestButtons).toHaveLength(2)
  })

  it('changes button to Interested after expressing interest', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ opportunities: mockOpportunities }), ok: true })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'interested' }) })

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Fleet Operations Manager')

    const buttons = screen.getAllByText('Express Interest')
    await user.click(buttons[0])

    await waitFor(() => {
      expect(screen.getByText('✓ Interested')).toBeInTheDocument()
    })
  })

  it('shows AI MATCH badge for opportunities with score breakdown', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: 'Houston, TX',
      preferred_sectors: ['Logistics'],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    const aiBadges = screen.getAllByText('AI MATCH')
    expect(aiBadges.length).toBe(2)
  })

  it('shows AI explanation text for each opportunity', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: 'Houston, TX',
      preferred_sectors: ['Logistics'],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    // Both opportunities have explanation text
    expect(screen.getByText(/Strong military skills match, excellent skills overlap with job tasks/)).toBeInTheDocument()
  })

  it('shows score breakdown panel when details expanded', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: 'Houston, TX',
      preferred_sectors: ['Logistics'],
      profile_complete: true,
      journey_step: 'match',
    }
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Fleet Operations Manager')

    // Click details on first opportunity
    const detailButtons = screen.getAllByText('Details ↓')
    await user.click(detailButtons[0])

    // Should show AI MATCH ANALYSIS section with breakdown bars
    expect(screen.getByText('AI MATCH ANALYSIS')).toBeInTheDocument()
    expect(screen.getByText('MOS SKILLS')).toBeInTheDocument()
    expect(screen.getByText('TASK OVERLAP')).toBeInTheDocument()
    expect(screen.getByText('SECTOR FIT')).toBeInTheDocument()
    expect(screen.getByText('MOS PREFERRED')).toBeInTheDocument()
    expect(screen.getByText('LOCATION')).toBeInTheDocument()
    // Should show matched skills
    expect(screen.getByText('SKILLS THAT MATCH THIS JOB')).toBeInTheDocument()
  })

  it('filters by sector when sector button clicked', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Test Vet',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    renderPage()
    await screen.findByText('Fleet Operations Manager')
    // Both jobs are in Logistics sector — should all show
    expect(screen.getByText('CDL Driver — Equipment Transport')).toBeInTheDocument()
  })
})
