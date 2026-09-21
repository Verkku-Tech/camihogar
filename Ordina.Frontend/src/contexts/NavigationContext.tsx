"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { apiClient, type NavigationSettingItemDto } from "../lib/api-client"

export interface NavigationItem {
  id: string
  name: string
  href: string
  category: "main" | "inventory" | "orders" | "configuration"
  active: boolean
  description: string
  superAdminOnly?: boolean
  allowedRoles?: string[]
}

export interface NavigationContextType {
  navigationItems: NavigationItem[]
  updateNavigationItems: (items: NavigationItem[]) => Promise<void>
  isNavigationItemActive: (id: string) => boolean
  isNavigationItemVisible: (id: string, userRole?: string) => boolean
  refreshNavigationSettings: () => Promise<void>
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export const defaultNavigationItems: NavigationItem[] = [
  {
    id: "home",
    name: "Inicio",
    href: "/",
    category: "main",
    active: true,
    description: "Panel principal y accesos rápidos",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "analytics",
    name: "Métricas",
    href: "/dashboard",
    category: "main",
    active: true,
    description: "Panel principal con métricas y estadísticas",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "proveedores",
    name: "Proveedores",
    href: "/proveedores",
    category: "main",
    active: true,
    description: "Gestión de proveedores",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "clientes",
    name: "Clientes",
    href: "/clientes",
    category: "main",
    active: true,
    description: "Gestión de clientes",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "tiendas",
    name: "Tiendas",
    href: "/tiendas",
    category: "main",
    active: true,
    description: "Gestión de tiendas",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "cuentas",
    name: "Cuentas",
    href: "/cuentas",
    category: "main",
    active: true,
    description: "Gestión de cuentas bancarias",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "reportes",
    name: "Reportes",
    href: "/reportes",
    category: "main",
    active: true,
    description: "Reportes y análisis",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "categorias",
    name: "Categorías",
    href: "/inventario/categorias",
    category: "inventory",
    active: true,
    description: "Gestión de categorías de productos",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "productos",
    name: "Productos",
    href: "/inventario/productos",
    category: "inventory",
    active: true,
    description: "Gestión de productos e inventario",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "pedidos-list",
    name: "Pedidos",
    href: "/pedidos",
    category: "orders",
    active: true,
    description: "Gestión de pedidos y presupuestos",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "reservas",
    name: "Reservas",
    href: "/pedidos/reservas",
    category: "orders",
    active: true,
    description: "Listado y confirmación de reservas en tienda",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "fabricacion",
    name: "Fabricación",
    href: "/pedidos/fabricacion",
    category: "orders",
    active: true,
    description: "Gestión de órdenes de fabricación",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "despachos",
    name: "Despachos",
    href: "/pedidos/despachos",
    category: "orders",
    active: true,
    description: "Gestión de pedidos listos para despachar",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "abbaco",
    name: "Abbaco (migración)",
    href: "/abbaco",
    category: "orders",
    active: true,
    description: "Migración de datos de Abbaco",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "usuarios",
    name: "Usuarios",
    href: "/configuracion/usuarios",
    category: "configuration",
    active: true,
    description: "Gestión de usuarios del sistema",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "navegacion",
    name: "Navegación",
    href: "/configuracion/navegacion",
    category: "configuration",
    active: true,
    description: "Configuración de menús de navegación",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "tasas",
    name: "Tasas de Cambio",
    href: "/configuracion/tasas",
    category: "configuration",
    active: true,
    description: "Gestión de tasas de cambio para monedas (USD, EUR)",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "comisiones",
    name: "Comisiones",
    href: "/configuracion/comisiones",
    category: "configuration",
    active: true,
    description: "Gestión de comisiones por rol o por usuario",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "roles",
    name: "Roles y Permisos",
    href: "/configuracion/roles",
    category: "configuration",
    active: true,
    description: "Gestión de roles y permisos del sistema",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "pin-acceso",
    name: "PIN de Acceso",
    href: "/configuracion/pin-acceso",
    category: "configuration",
    active: true,
    description: "Generación de PIN para edición de reservas en tienda",
    superAdminOnly: false,
    allowedRoles: [],
  },
  {
    id: "sistema",
    name: "Sistema",
    href: "/configuracion/sistema",
    category: "configuration",
    active: true,
    description: "Mantenimiento de cache local del navegador",
    superAdminOnly: false,
    allowedRoles: [],
  },
]

export function normalizeNavigationItems(items: NavigationItem[]): NavigationItem[] {
  // ponytail: remove legacy 'dashboard' item and ensure default item definitions are up to date
  let updated = items.filter((i) => i.id !== "dashboard")

  const result: NavigationItem[] = []
  for (const def of defaultNavigationItems) {
    const existing = updated.find((i) => i.id === def.id)
    if (existing) {
      result.push({
        ...def,
        active: existing.active ?? def.active,
        superAdminOnly: existing.superAdminOnly ?? def.superAdminOnly ?? false,
        allowedRoles: existing.allowedRoles ?? def.allowedRoles ?? [],
      })
    } else {
      result.push({ ...def })
    }
  }
  return result
}

export function isItemVisibleForRole(item: NavigationItem, userRole?: string): boolean {
  if (!item.active) return false
  if (item.superAdminOnly) {
    return userRole === "Super Administrator"
  }
  if (item.allowedRoles && item.allowedRoles.length > 0) {
    if (userRole === "Super Administrator") return true
    return item.allowedRoles.includes(userRole || "")
  }
  return true
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>(defaultNavigationItems)

  const applyBackendSettings = useCallback((backendSettings: NavigationSettingItemDto[]) => {
    if (!backendSettings || backendSettings.length === 0) return

    setNavigationItems((current) => {
      const merged = current.map((item) => {
        const found = backendSettings.find((s) => s.id === item.id)
        if (!found) return item
        return {
          ...item,
          active: found.active,
          superAdminOnly: found.superAdminOnly ?? false,
          allowedRoles: found.allowedRoles ?? [],
        }
      })
      if (typeof window !== "undefined") {
        localStorage.setItem("camihogar-navigation-settings", JSON.stringify(merged))
      }
      return merged
    })
  }, [])

  const refreshNavigationSettings = useCallback(async () => {
    try {
      const backendSettings = await apiClient.getNavigationSettings()
      applyBackendSettings(backendSettings)
    } catch {
      // ponytail: if network fails or unauthenticated, rely on local cached items
    }
  }, [applyBackendSettings])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("camihogar-navigation-settings")
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          if (Array.isArray(parsed)) {
            setNavigationItems(normalizeNavigationItems(parsed))
          }
        } catch (error) {
          console.error("Error loading navigation settings:", error)
        }
      }
    }

    refreshNavigationSettings()
  }, [refreshNavigationSettings])

  const updateNavigationItems = async (items: NavigationItem[]) => {
    setNavigationItems(items)
    if (typeof window !== "undefined") {
      localStorage.setItem("camihogar-navigation-settings", JSON.stringify(items))
    }

    try {
      const dtos: NavigationSettingItemDto[] = items.map((i) => ({
        id: i.id,
        active: i.active,
        superAdminOnly: !!i.superAdminOnly,
        allowedRoles: i.allowedRoles || [],
      }))
      await apiClient.updateNavigationSettings(dtos)
    } catch (err) {
      console.warn("Could not sync navigation settings with backend:", err)
    }
  }

  const isNavigationItemActive = (id: string) => {
    const item = navigationItems.find((item) => item.id === id)
    return item?.active ?? true
  }

  const isNavigationItemVisible = (id: string, userRole?: string) => {
    const item = navigationItems.find((item) => item.id === id)
    if (!item) return true
    return isItemVisibleForRole(item, userRole)
  }

  return (
    <NavigationContext.Provider
      value={{
        navigationItems,
        updateNavigationItems,
        isNavigationItemActive,
        isNavigationItemVisible,
        refreshNavigationSettings,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error("useNavigation must be used within a NavigationProvider")
  }
  return context
}
