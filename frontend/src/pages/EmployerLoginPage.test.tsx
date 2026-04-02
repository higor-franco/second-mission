import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployerLoginPage, { EmployerRegisterPage } from './EmployerLoginPage'

// Mock employer auth
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockLogout = vi.fn()
const mockRefresh = vi.fn()
const mockUpdateEmployer = vi.fn()

vi.mock('@/lib/employer-auth', () => ({
  useEmployerAuth: () => ({
    employer: null,
    loading: false,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
    refresh: mockRefresh,
    updateEmployer: mockUpdateEmployer,
  }),
  EmployerAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <EmployerLoginPage />
    </MemoryRouter>
  )
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <EmployerRegisterPage />
    </MemoryRouter>
  )
}

describe('EmployerLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the employer sign in form', () => {
    renderLogin()
    expect(screen.getByText('SIGN IN')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows link to registration page', () => {
    renderLogin()
    expect(screen.getByText(/create employer account/i)).toBeInTheDocument()
  })

  it('shows link to veteran login', () => {
    renderLogin()
    expect(screen.getByText(/sign in here/i)).toBeInTheDocument()
  })

  it('submits login with email and password', async () => {
    mockLogin.mockResolvedValue({ ok: true, message: 'logged in' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.type(screen.getByPlaceholderText('Your password'), 'testpass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('test@company.com', 'testpass123')
  })

  it('shows error on failed login', async () => {
    mockLogin.mockResolvedValue({ ok: false, message: 'invalid email or password' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@company.com'), 'test@company.com')
    await user.type(screen.getByPlaceholderText('Your password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('invalid email or password')).toBeInTheDocument()
  })
})

describe('EmployerRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form', () => {
    renderRegister()
    expect(screen.getByText('EMPLOYER REGISTRATION')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ACME Corp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create employer account/i })).toBeInTheDocument()
  })

  it('validates password match', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('ACME Corp'), 'Test Corp')
    await user.type(screen.getByPlaceholderText('you@company.com'), 'x@test.com')
    await user.type(screen.getByPlaceholderText('Min 8 chars'), 'password123')
    await user.type(screen.getByPlaceholderText('Confirm'), 'different123')
    await user.click(screen.getByRole('button', { name: /create employer account/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('validates minimum password length', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('ACME Corp'), 'Test Corp')
    await user.type(screen.getByPlaceholderText('you@company.com'), 'x@test.com')
    await user.type(screen.getByPlaceholderText('Min 8 chars'), 'short')
    await user.type(screen.getByPlaceholderText('Confirm'), 'short')
    await user.click(screen.getByRole('button', { name: /create employer account/i }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('submits registration with all fields', async () => {
    mockRegister.mockResolvedValue({ ok: true, message: 'registration successful' })
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('ACME Corp'), 'Test Corp')
    await user.type(screen.getByPlaceholderText('John Smith'), 'Jane Doe')
    await user.type(screen.getByPlaceholderText('you@company.com'), 'jane@testcorp.com')
    await user.type(screen.getByPlaceholderText('Min 8 chars'), 'password123')
    await user.type(screen.getByPlaceholderText('Confirm'), 'password123')
    await user.click(screen.getByRole('button', { name: /create employer account/i }))

    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
      email: 'jane@testcorp.com',
      password: 'password123',
      company_name: 'Test Corp',
      contact_name: 'Jane Doe',
    }))
  })
})
