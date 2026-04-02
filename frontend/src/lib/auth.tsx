import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface VeteranProfile {
  id: number
  email: string
  name: string
  mos_code: string
  rank: string
  years_of_service: number
  separation_date: string
  location: string
  preferred_sectors: string[]
  profile_complete: boolean
  journey_step: string
}

interface AuthContextType {
  veteran: VeteranProfile | null
  loading: boolean
  login: (email: string) => Promise<{ ok: boolean; message: string; dev_link?: string | null }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateVeteran: (partial: Partial<VeteranProfile>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [veteran, setVeteran] = useState<VeteranProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setVeteran(data)
      } else {
        setVeteran(null)
      }
    } catch {
      setVeteran(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string) => {
    const res = await fetch('/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    })
    const data = await res.json()
    return { ok: res.ok, message: data.message || data.error, dev_link: data.dev_link || null }
  }

  const updateVeteran = useCallback((partial: Partial<VeteranProfile>) => {
    setVeteran(prev => prev ? { ...prev, ...partial } : prev)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setVeteran(null)
  }

  return (
    <AuthContext.Provider value={{ veteran, loading, login, logout, refresh, updateVeteran }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
