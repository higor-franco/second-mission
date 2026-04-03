import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployerResetPasswordPage from './EmployerResetPasswordPage'

vi.mock('@/lib/employer-auth', () => ({
  useEmployerAuth: () => ({
    employer: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    updateEmployer: vi.fn(),
  }),
  EmployerAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/employer/reset-password${search}`]}>
      <EmployerResetPasswordPage />
    </MemoryRouter>
  )
}

// Mock useSearchParams since MemoryRouter doesn't set them for component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  let mockToken = ''
  return {
    ...actual,
    useSearchParams: () => [
      { get: (key: string) => key === 'token' ? mockToken : null },
    ],
    // Export a helper to set the token for tests
    __setMockToken: (token: string) => { mockToken = token },
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setMockToken } = await import('react-router-dom') as any

describe('EmployerResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('shows invalid link message when no token is provided', () => {
    __setMockToken('')
    renderPage()
    expect(screen.getByText('INVALID RESET LINK')).toBeInTheDocument()
    expect(screen.getByText(/request new link/i)).toBeInTheDocument()
  })

  it('renders the reset password form when token is present', () => {
    __setMockToken('valid-test-token')
    renderPage('?token=valid-test-token')
    expect(screen.getByText('SET NEW PASSWORD')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('validates password match', async () => {
    __setMockToken('valid-test-token')
    const user = userEvent.setup()
    renderPage('?token=valid-test-token')

    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'different123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it('validates minimum password length', async () => {
    __setMockToken('valid-test-token')
    const user = userEvent.setup()
    renderPage('?token=valid-test-token')

    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'short')
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('submits new password and shows success', async () => {
    __setMockToken('valid-test-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password reset successfully.' }),
    } as Response)

    const user = userEvent.setup()
    renderPage('?token=valid-test-token')

    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('PASSWORD RESET')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/employer/login')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/employer/reset-password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'valid-test-token', password: 'newpassword123' }),
    }))
  })

  it('shows error on expired/invalid token', async () => {
    __setMockToken('expired-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid or expired reset link' }),
    } as Response)

    const user = userEvent.setup()
    renderPage('?token=expired-token')

    await user.type(screen.getByPlaceholderText('Min 8 characters'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('invalid or expired reset link')).toBeInTheDocument()
  })
})
