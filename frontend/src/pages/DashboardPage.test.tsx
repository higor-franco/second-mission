import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'

const mockLogout = vi.fn()
const mockRefresh = vi.fn()

let mockVeteran: any = null
let mockLoading = false

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: mockVeteran,
    loading: mockLoading,
    logout: mockLogout,
    refresh: mockRefresh,
    login: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock fetch for /api/veteran/matches
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

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
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ roles: [], message: '' }),
    })
  })

  it('shows loading spinner while auth is loading', () => {
    mockLoading = true
    mockVeteran = null
    renderDashboard()
    // Should show a spinner (animate-spin class on an element)
    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
    mockLoading = false
  })

  it('shows welcome message for authenticated veteran', () => {
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
    }
    renderDashboard()
    expect(screen.getByText('WELCOME BACK, JOHN DOE')).toBeInTheDocument()
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
    }
    renderDashboard()
    expect(screen.getByText('COMPLETE YOUR PROFILE')).toBeInTheDocument()
  })

  it('shows matched roles when available', async () => {
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
    }
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          roles: [
            {
              onet_code: '53-1031.00',
              title: 'Logistics Coordinator',
              description: 'Coordinate logistics',
              sector: 'Logistics',
              salary_min: 48000,
              salary_max: 78000,
              match_score: 92,
              transferable_skills: ['Fleet Management', 'Route Planning'],
            },
          ],
        }),
    })

    renderDashboard()

    // Wait for the role to appear
    const title = await screen.findByText('Logistics Coordinator')
    expect(title).toBeInTheDocument()
  })
})
