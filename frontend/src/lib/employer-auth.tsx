import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface EmployerProfile {
  id: number
  email: string
  company_name: string
  contact_name: string
  sector: string
  location: string
  description: string
  // Public-facing identity fields rendered on /companies/:id and used to
  // help veterans research the employer. Marked optional so the app still
  // works if a legacy backend omits them — the new fields were added in
  // migration 012 and are always present from modern servers.
  website_url?: string
  linkedin_url?: string
  company_size?: string
  founded_year?: number
  is_active: boolean
}

interface EmployerAuthContextType {
  employer: EmployerProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string; employer?: EmployerProfile }>
  register: (data: RegisterData) => Promise<{ ok: boolean; message: string; employer?: EmployerProfile }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateEmployer: (partial: Partial<EmployerProfile>) => void
}

interface RegisterData {
  email: string
  password: string
  company_name: string
  contact_name: string
  sector: string
  location: string
  description: string
}

const EmployerAuthContext = createContext<EmployerAuthContextType | null>(null)

export function EmployerAuthProvider({ children }: { children: ReactNode }) {
  const [employer, setEmployer] = useState<EmployerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEmployer(data)
      } else {
        setEmployer(null)
      }
    } catch {
      setEmployer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/employer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })
    const data = await res.json()
    if (res.ok && data.employer) {
      setEmployer(data.employer)
    }
    return { ok: res.ok, message: data.message || data.error, employer: data.employer }
  }

  const register = async (regData: RegisterData) => {
    const res = await fetch('/api/employer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData),
      credentials: 'include',
    })
    const data = await res.json()
    if (res.ok && data.employer) {
      setEmployer(data.employer)
    }
    return { ok: res.ok, message: data.message || data.error, employer: data.employer }
  }

  const updateEmployer = useCallback((partial: Partial<EmployerProfile>) => {
    setEmployer(prev => prev ? { ...prev, ...partial } : prev)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setEmployer(null)
  }

  return (
    <EmployerAuthContext.Provider value={{ employer, loading, login, register, logout, refresh, updateEmployer }}>
      {children}
    </EmployerAuthContext.Provider>
  )
}

export function useEmployerAuth() {
  const ctx = useContext(EmployerAuthContext)
  if (!ctx) throw new Error('useEmployerAuth must be used within EmployerAuthProvider')
  return ctx
}
