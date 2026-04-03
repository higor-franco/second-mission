import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployerForgotPasswordPage from './EmployerForgotPasswordPage'

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

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployerForgotPasswordPage />
    </MemoryRouter>
  )
}

describe('EmployerForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('renders the forgot password form', () => {
    renderPage()
    expect(screen.getByText('FORGOT PASSWORD')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('shows link back to sign in', () => {
    renderPage()
    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument()
  })

  it('submits email and shows success message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'If that email is registered, you\'ll receive a password reset link shortly.' }),
    } as Response)

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('EMAIL SENT')).toBeInTheDocument()
    expect(screen.getByText(/test@company.com/)).toBeInTheDocument()
  })

  it('shows dev link in dev mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'Dev mode: use the link below',
        dev_link: 'http://localhost:5173/employer/reset-password?token=abc123',
      }),
    } as Response)

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('DEV MODE')).toBeInTheDocument()
    expect(screen.getByText(/click here to reset password/i)).toBeInTheDocument()
  })

  it('shows error on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'valid email is required' }),
    } as Response)

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('valid email is required')).toBeInTheDocument()
  })

  it('shows error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Network error. Please try again.')).toBeInTheDocument()
  })
})
