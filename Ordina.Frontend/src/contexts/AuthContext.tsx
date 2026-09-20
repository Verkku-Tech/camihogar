import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiFetch, setAuthToken, getAuthToken, requestTokenRefresh } from '../lib/api-client'

export interface User {
  id: string
  username: string
  email: string
  role: string
  name: string
  status: string
  permissions: string[]
  storeId?: string
  storeName?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Silent session restore on app startup from HttpOnly cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await requestTokenRefresh()
        if (token) {
          setTokenState(token)
          // Fetch user details
          const me = await apiFetch<User>('auth/me')
          setUser(me)
        }
      } catch (err) {
        // Not authenticated or offline
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()

    const handleAuthExpired = () => {
      setAuthToken(null)
      setTokenState(null)
      setUser(null)
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [])

  const login = async (username: string, password: string, rememberMe = true) => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe })
    })

    setAuthToken(res.token)
    setTokenState(res.token)
    setUser(res.user)
  }

  const logout = async () => {
    try {
      await apiFetch('auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout errors
    } finally {
      setAuthToken(null)
      setTokenState(null)
      setUser(null)
    }
  }

  const hasPermission = (perm: string): boolean => {
    if (!user) return false
    if (user.role === 'Super Administrator' || user.role === 'Administrator' || user.permissions?.includes('*')) return true
    return user.permissions?.includes(perm) ?? false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
