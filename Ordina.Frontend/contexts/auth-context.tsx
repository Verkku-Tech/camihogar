"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiClient, type UserDto } from "@/lib/api-client"

interface User {
  id: string
  username: string
  email: string
  role: string
  name: string
  status: "active" | "inactive"
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isOffline: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapUserDtoToUser(dto: UserDto): User {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    role: dto.role,
    name: dto.name,
    status: dto.status as "active" | "inactive",
    permissions: dto.permissions || [],
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Detectar conexión
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine
      setIsOffline(!online)

      // Si volvió la conexión, intentar refresh si es necesario
      if (online && user) {
        const tokenExpiresAt = parseInt(localStorage.getItem("token_expires_at") || "0")
        const now = Date.now()

        // Si el token expira en menos de 2 horas, intentar refresh
        if (tokenExpiresAt - now < 2 * 60 * 60 * 1000) {
          attemptRefreshToken()
        }
      }
    }

    // Verificar estado inicial
    updateOnlineStatus()

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
    }
  }, [user])

  const attemptRefreshToken = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token")
    if (!refreshToken) {
      return false
    }

    // Verificar si el refresh token expiró
    const refreshExpiresAt = parseInt(localStorage.getItem("refresh_token_expires_at") || "0")
    if (Date.now() > refreshExpiresAt) {
      // Refresh token expirado, forzar login
      logout()
      return false
    }

    // Si no hay conexión, no intentar refresh
    if (!navigator.onLine) {
      console.log("⚠️ Sin conexión, no se puede refrescar el token")
      return false
    }

    try {
      const success = await apiClient.refreshToken()
      if (success) {
        console.log("✅ Token refreshed successfully")
        return true
      }
      return false
    } catch (error) {
      console.error("❌ Token refresh failed:", error)
      return false
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("token_expires_at")
    localStorage.removeItem("refresh_token_expires_at")
    localStorage.removeItem("user_data")
    localStorage.removeItem("remember_me")

    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    setUser(null)
    router.push("/login")
  }, [router])

  // Verificar y refrescar token periódicamente (cada hora)
  useEffect(() => {
    if (!user) return

    const checkAndRefresh = async () => {
      const now = Date.now()
      const expiresAt = parseInt(localStorage.getItem("token_expires_at") || "0")

      // Si el token expira en menos de 2 horas, intentar refresh
      if (expiresAt - now < 2 * 60 * 60 * 1000) {
        await attemptRefreshToken()
      }
    }

    // Verificar cada hora
    refreshIntervalRef.current = setInterval(checkAndRefresh, 60 * 60 * 1000)

    // Verificar inmediatamente al montar
    checkAndRefresh()

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [user, attemptRefreshToken])

  // Al iniciar, verificar tokens y hacer refresh si es necesario
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token")
        const refreshToken = localStorage.getItem("refresh_token")
        const tokenExpiresAt = parseInt(localStorage.getItem("token_expires_at") || "0")
        const refreshExpiresAt = parseInt(localStorage.getItem("refresh_token_expires_at") || "0")
        const userData = localStorage.getItem("user_data")

        if (!token || !refreshToken) {
          setIsLoading(false)
          return
        }

        // Verificar si el refresh token expiró
        if (Date.now() > refreshExpiresAt) {
          // Refresh token expirado, limpiar y forzar login
          logout()
          return
        }

        // Si el token expiró pero el refresh token sigue válido
        if (Date.now() > tokenExpiresAt) {
          // Intentar refresh inmediatamente
          const refreshed = await attemptRefreshToken()
          if (!refreshed) {
            // Si no se pudo refrescar, permitir modo offline temporal
            console.log("⚠️ Token expirado pero sin conexión, modo offline")
          }
        }

        // Cargar usuario
        if (userData) {
          try {
            const userDto = JSON.parse(userData) as UserDto
            setUser(mapUserDtoToUser(userDto))
          } catch (error) {
            console.error("Error parsing user data:", error)
            localStorage.removeItem("user_data")
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [logout, attemptRefreshToken])

  const login = async (username: string, password: string, rememberMe = false) => {
    setIsLoading(true)

    try {
      const response = await apiClient.login(username, password, rememberMe)

      // Guardar tokens con fechas de expiración
      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("refresh_token", response.refreshToken)
      localStorage.setItem("token_expires_at", new Date(response.expiresAt).getTime().toString())
      localStorage.setItem(
        "refresh_token_expires_at",
        new Date(response.refreshTokenExpiresAt).getTime().toString()
      )
      localStorage.setItem("user_data", JSON.stringify(response.user))

      if (rememberMe) {
        localStorage.setItem("remember_me", "true")
      }

      setUser(mapUserDtoToUser(response.user))
      router.push("/")
    } catch (error: any) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false
      // Super Administrator has all permissions
      if (user.role === "Super Administrator") return true
      return user.permissions?.includes(permission) || false
    },
    [user],
  )

  const refreshToken = useCallback(async () => {
    await attemptRefreshToken()
  }, [attemptRefreshToken])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isOffline,
    login,
    logout,
    refreshToken,
    hasPermission,
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
