import React, { createContext, useContext, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch, setAuthToken, getAuthToken, requestTokenRefresh } from '../lib/api-client'
import { getDb } from '../lib/db'

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
  avatarUrl?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isImpersonating: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  impersonate: (userId: string) => Promise<void>
  stopImpersonation: () => void
  hasPermission: (permission: string) => boolean
  updateUser: (updates: Partial<User>) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImpersonating, setIsImpersonating] = useState(false)

  // Silent session restore on app startup from HttpOnly cookie or active impersonation
  useEffect(() => {
    async function restoreSession() {
      try {
        const impersonationSessionStr = sessionStorage.getItem('ordina_impersonator_session')
        if (impersonationSessionStr) {
          try {
            const parsed = JSON.parse(impersonationSessionStr)
            if (parsed.impersonatedToken && parsed.impersonatedUser) {
              setAuthToken(parsed.impersonatedToken)
              setTokenState(parsed.impersonatedToken)
              setUser(parsed.impersonatedUser)
              setIsImpersonating(true)
              setIsLoading(false)
              return
            }
          } catch {
            sessionStorage.removeItem('ordina_impersonator_session')
          }
        }

        const token = await requestTokenRefresh()
        if (token) {
          setTokenState(token)
          try {
            // Fetch user details
            const me = await apiFetch<User>('/api/auth/me')
            setUser(me)
            localStorage.setItem('cached_auth_user', JSON.stringify(me))
          } catch {
            // Server offline: restore cached user if available
            const cachedUserStr = localStorage.getItem('cached_auth_user')
            if (cachedUserStr) {
              try {
                setUser(JSON.parse(cachedUserStr))
              } catch {
                // ignore
              }
            }
          }
        } else {
          // If refresh returned null but we are offline within 1-hour grace period
          const lastActive = Number(localStorage.getItem('auth_last_active_at') || '0')
          const ONE_HOUR = 60 * 60 * 1000
          if (lastActive > 0 && Date.now() - lastActive < ONE_HOUR) {
            const cachedUserStr = localStorage.getItem('cached_auth_user')
            const existingToken = getAuthToken()
            if (cachedUserStr && existingToken) {
              try {
                setUser(JSON.parse(cachedUserStr))
                setTokenState(existingToken)
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (err) {
        // Not authenticated or offline
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()

    const handleAuthExpired = () => {
      sessionStorage.removeItem('ordina_impersonator_session')
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cached_auth_user')
        localStorage.removeItem('auth_last_active_at')
      }
      setAuthToken(null)
      setTokenState(null)
      setUser(null)
      setIsImpersonating(false)
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cached_auth_user', JSON.stringify(res.user))
      localStorage.setItem('auth_last_active_at', Date.now().toString())
    }
    setIsImpersonating(false)
    sessionStorage.removeItem('ordina_impersonator_session')
  }

  const logout = async () => {
    try {
      await apiFetch<void>('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem('ordina_impersonator_session')
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cached_auth_user')
        localStorage.removeItem('auth_last_active_at')
      }
      setAuthToken(null)
      setTokenState(null)
      setUser(null)
      setIsImpersonating(false)

      // ponytail: clear memory queries and offline cache on logout to prevent unauthorized access
      try {
        queryClient.clear()
        const db = await getDb()
        await db.delete('tanstack_cache', 'REACT_QUERY_OFFLINE_CACHE')
      } catch {
        // ignore
      }

      window.location.href = '/login'
    }
  }

  const impersonate = async (targetUserId: string) => {
    const res = await apiFetch<{ token: string; user: User }>(`/api/auth/impersonate/${targetUserId}`, {
      method: 'POST'
    })

    const superAdminSession = {
      superAdminToken: token,
      superAdminUser: user,
      impersonatedToken: res.token,
      impersonatedUser: res.user,
    }
    sessionStorage.setItem('ordina_impersonator_session', JSON.stringify(superAdminSession))

    setAuthToken(res.token)
    setTokenState(res.token)
    setUser(res.user)
    setIsImpersonating(true)
  }

  const stopImpersonation = () => {
    const impersonationSessionStr = sessionStorage.getItem('ordina_impersonator_session')
    if (impersonationSessionStr) {
      try {
        const parsed = JSON.parse(impersonationSessionStr)
        if (parsed.superAdminToken && parsed.superAdminUser) {
          setAuthToken(parsed.superAdminToken)
          setTokenState(parsed.superAdminToken)
          setUser(parsed.superAdminUser)
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem('ordina_impersonator_session')
    }
    setIsImpersonating(false)
  }

  const hasPermission = (perm: string): boolean => {
    if (!user) return false
    if (user.role === 'Super Administrator' || user.role === 'Administrator' || user.permissions?.includes('*')) return true
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(perm)
    }
    // Fallback if permissions array hasn't been cached or refreshed yet
    if (user.role === 'Store Seller') {
      return [
        'orders.read', 'orders.create', 'orders.update', 'orders.payments.manage',
        'budgets.create', 'budgets.update', 'clients.read', 'clients.create', 'clients.update', 'products.read'
      ].includes(perm)
    }
    if (user.role === 'Online Seller') {
      return [
        'orders.read', 'orders.create', 'orders.update', 'orders.payments.manage',
        'budgets.create', 'budgets.update', 'clients.read', 'clients.create', 'clients.update', 'products.read',
        'inventory.view_stock', 'dispatch.read'
      ].includes(perm)
    }
    return false
  }

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }

  const refreshUser = async () => {
    try {
      const me = await apiFetch<User>('/api/auth/me')
      if (me) {
        setUser(me)
      }
    } catch (err) {
      console.warn('Failed to refresh user:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isImpersonating,
        login,
        logout,
        impersonate,
        stopImpersonation,
        hasPermission,
        updateUser,
        refreshUser,
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
