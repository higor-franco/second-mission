import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from './LoginPage'

// Mock the auth module
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    veteran: null,
    loading: false,
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sign in form', () => {
    renderLogin()
    expect(screen.getByText('SIGN IN')).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
  })

  it('disables submit when email is empty', () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: /send magic link/i })
    expect(btn).toBeDisabled()
  })

  it('sends magic link on valid email submit', async () => {
    mockLogin.mockResolvedValue({ ok: true, message: 'Check your inbox.' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send magic link/i }))

    expect(mockLogin).toHaveBeenCalledWith('test@example.com')
    expect(screen.getByText('CHECK YOUR EMAIL')).toBeInTheDocument()
  })

  it('shows error on failed submission', async () => {
    mockLogin.mockResolvedValue({ ok: false, message: 'Something went wrong.' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'bad@example.com')
    await user.click(screen.getByRole('button', { name: /send magic link/i }))

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })

  it('allows going back to try a different email', async () => {
    mockLogin.mockResolvedValue({ ok: true, message: 'Check your inbox.' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send magic link/i }))

    expect(screen.getByText('CHECK YOUR EMAIL')).toBeInTheDocument()

    await user.click(screen.getByText(/use a different email/i))
    expect(screen.getByText('SIGN IN')).toBeInTheDocument()
  })
})
