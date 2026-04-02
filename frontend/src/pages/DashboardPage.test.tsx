import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'

const mockLogout = vi.fn()

let mockVeteran: any = null
let mockLoading = false

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: mockVeteran,
    loading: mockLoading,
    logout: mockLogout,
    login: vi.fn(),
    refresh: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Helper: return appropriate mock based on URL
function mockFetchForUrl(url: string) {
  if (url.includes('/api/veteran/journey')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        journey_step: 'translate',
        has_mos: true,
        has_profile: true,
        total_matches: 3,
        status_counts: {},
      }),
    })
  }
  return Promise.resolve({
    json: () => Promise.resolve({ roles: [], message: '' }),
  })
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => mockFetchForUrl(url))
  })

  it('shows loading spinner while auth is loading', () => {
    mockLoading = true
    mockVeteran = null
    renderDashboard()
    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
    mockLoading = false
  })

  it('shows welcome message with first name for authenticated veteran', () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'John Doe',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 6,
      separation_date: '2026-09-15',
      location: 'Killeen, TX',
      preferred_sectors: ['Energy'],
      profile_complete: true,
      journey_step: 'translate',
    }
    renderDashboard()
    // Dashboard uses first name only: name.split(' ')[0]
    expect(screen.getByText('WELCOME BACK, JOHN')).toBeInTheDocument()
    expect(screen.getByText('vet@example.com')).toBeInTheDocument()
    expect(screen.getByText('MOS: 88M')).toBeInTheDocument()
  })

  it('shows profile completion banner when profile is incomplete', () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
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
    renderDashboard()
    expect(screen.getByText('COMPLETE YOUR PROFILE')).toBeInTheDocument()
  })

  it('shows journey progress section', () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Jane',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'translate',
    }
    renderDashboard()
    expect(screen.getByText('YOUR JOURNEY')).toBeInTheDocument()
    expect(screen.getByText('DISCOVER')).toBeInTheDocument()
    expect(screen.getByText('TRANSLATE')).toBeInTheDocument()
    expect(screen.getByText('MATCH')).toBeInTheDocument()
    expect(screen.getByText('PLACE')).toBeInTheDocument()
  })

  it('shows career translations section when roles returned', async () => {
    mockVeteran = {
      id: 1,
      email: 'vet@example.com',
      name: 'Jane',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 4,
      separation_date: '',
      location: '',
      preferred_sectors: [],
      profile_complete: true,
      journey_step: 'match',
    }
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/veteran/journey')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            journey_step: 'match',
            has_mos: true,
            has_profile: true,
            total_matches: 5,
            status_counts: { matched: 5 },
          }),
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          roles: [
            {
              onet_code: '53-1031.00',
              title: 'Logistics Coordinator',
              description: 'Coordinate logistics operations',
              sector: 'Logistics',
              salary_min: 48000,
              salary_max: 78000,
              match_score: 92,
              transferable_skills: ['Fleet Management', 'Route Planning'],
            },
          ],
        }),
      })
    })

    renderDashboard()
    const title = await screen.findByText('Logistics Coordinator')
    expect(title).toBeInTheDocument()
  })
})
