"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  username: string
  email: string
  role: "Super Administrator" | "Administrator" | "Supervisor" | "Store Seller" | "Online Seller"
  name: string
  status: "active" | "inactive"
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users for demonstration
const mockUsers: User[] = [
  {
    id: "1",
    username: "admin",
    email: "admin@camihogar.com",
    role: "Super Administrator",
    name: "Administrador Principal",
    status: "active",
  },
  {
    id: "2",
    username: "supervisor",
    email: "supervisor@camihogar.com",
    role: "Supervisor",
    name: "Juan Supervisor",
    status: "active",
  },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  const clearTimeouts = useCallback(() => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user_data")
    setUser(null)
    clearTimeouts()
    router.push("/login")
  }, [router, clearTimeouts])

  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token")
      if (!refreshToken) {
        throw new Error("No refresh token available")
      }

      // Mock API call - replace with actual API
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Generate new tokens
      const newToken = `mock_token_${Date.now()}`
      const newRefreshToken = `mock_refresh_${Date.now()}`

      localStorage.setItem("auth_token", newToken)
      localStorage.setItem("refresh_token", newRefreshToken)

      console.log("[v0] Token refreshed successfully")
    } catch (error) {
      console.error("[v0] Token refresh failed:", error)
      logout()
    }
  }, [logout])

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current)

    inactivityTimeoutRef.current = setTimeout(
      () => {
        alert("Tu sesión ha expirado por inactividad")
        logout()
      },
      30 * 60 * 1000,
    ) // 30 minutes
  }, [logout])

  const setupSessionManagement = useCallback(() => {
    // Auto refresh token every 14 minutes (assuming 15 min expiry)
    const refreshInterval = setInterval(refreshToken, 14 * 60 * 1000)

    // Setup inactivity timer
    resetInactivityTimer()

    // Listen for user activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]
    const resetTimer = () => resetInactivityTimer()

    events.forEach((event) => {
      document.addEventListener(event, resetTimer, true)
    })

    return () => {
      clearInterval(refreshInterval)
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer, true)
      })
      clearTimeouts()
    }
  }, [refreshToken, resetInactivityTimer, clearTimeouts])

  const login = async (username: string, password: string, rememberMe = false) => {
    setIsLoading(true)

    try {
      // Mock API call - replace with actual authentication
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockUser = mockUsers.find(
        (u) => (u.username === username || u.email === username) && password === "password123",
      )

      if (!mockUser) {
        throw new Error("Usuario o contraseña incorrectos")
      }

      if (mockUser.status === "inactive") {
        throw new Error("Tu cuenta está desactivada. Contacta al administrador.")
      }

      // Generate mock tokens
      const token = `mock_token_${Date.now()}`
      const refreshTokenValue = `mock_refresh_${Date.now()}`

      // Store tokens
      localStorage.setItem("auth_token", token)
      localStorage.setItem("refresh_token", refreshTokenValue)
      localStorage.setItem("user_data", JSON.stringify(mockUser))

      if (rememberMe) {
        localStorage.setItem("remember_me", "true")
      }

      setUser(mockUser)

      // Log access
      console.log(`[v0] User ${mockUser.username} logged in at ${new Date().toISOString()}`)
    } catch (error: any) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token")
        const userData = localStorage.getItem("user_data")

        if (token && userData) {
          const user = JSON.parse(userData)
          setUser(user)
        }
      } catch (error) {
        console.error("[v0] Auth initialization error:", error)
        localStorage.clear()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  // Setup session management when user logs in
  useEffect(() => {
    if (user) {
      const cleanup = setupSessionManagement()
      return cleanup
    }
  }, [user, setupSessionManagement])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
