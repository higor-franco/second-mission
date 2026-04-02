import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployerDashboardPage from './EmployerDashboardPage'

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

const mockLogout = vi.fn()
const mockRefresh = vi.fn()
const mockUpdateEmployer = vi.fn()

let employerState = mockEmployer

vi.mock('@/lib/employer-auth', () => ({
  useEmployerAuth: () => ({
    employer: employerState,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    refresh: mockRefresh,
    updateEmployer: mockUpdateEmployer,
  }),
  EmployerAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EmployerDashboardPage />
    </MemoryRouter>
  )
}

describe('EmployerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    employerState = mockEmployer

    // Mock fetch for dashboard data
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/employer/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            active_listings: 3,
            inactive_listings: 1,
            total_listings: 4,
            total_candidates: 7,
          }),
        })
      }
      if (url.includes('/api/employer/listings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            listings: [
              {
                id: 1, title: 'Field Tech', sector: 'Energy', location: 'Houston, TX',
                salary_min: 55000, salary_max: 78000, is_active: true, wotc_eligible: true,
                employment_type: 'full-time', description: '', requirements: [],
                posted_at: '2026-03-15T00:00:00Z', tasks: [], benefits: [],
                mos_codes_preferred: ['88M'], onet_code: '49-9081', role_title: 'Wind Tech',
              },
            ],
          }),
        })
      }
      if (url.includes('/api/employer/candidates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            candidates: [
              {
                application_id: 1, status: 'interested', match_score: 87,
                applied_at: '2026-03-20T00:00:00Z', veteran_id: 1, name: 'SGT Johnson',
                mos_code: '88M', rank: 'E-5', years_of_service: 6,
                separation_date: '2026-06-01', veteran_location: 'Killeen, TX',
                job_listing_id: 1, job_title: 'Field Tech', sector: 'Energy',
              },
            ],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  it('shows company name as heading', async () => {
    renderDashboard()
    expect(screen.getByText('TEST CORP')).toBeInTheDocument()
  })

  it('shows employer badge', () => {
    renderDashboard()
    expect(screen.getByText('EMPLOYER')).toBeInTheDocument()
  })

  it('loads and displays stats', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument() // active listings
    })
    expect(screen.getByText('4')).toBeInTheDocument() // total listings
    expect(screen.getByText('7')).toBeInTheDocument() // candidates
  })

  it('loads and displays job listings', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Field Tech')).toBeInTheDocument()
    })
    expect(screen.getByText('WOTC')).toBeInTheDocument()
    expect(screen.getAllByText('MOS: 88M').length).toBeGreaterThan(0)
  })

  it('loads and displays candidates', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('SGT Johnson')).toBeInTheDocument()
    })
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('INTERESTED')).toBeInTheDocument()
  })

  it('shows empty state when no listings exist', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/employer/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ active_listings: 0, inactive_listings: 0, total_listings: 0, total_candidates: 0 }),
        })
      }
      if (url.includes('/api/employer/listings')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ listings: [] }) })
      }
      if (url.includes('/api/employer/candidates')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ candidates: [] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('NO LISTINGS YET')).toBeInTheDocument()
    })
    expect(screen.getByText('NO CANDIDATES YET')).toBeInTheDocument()
  })
})
