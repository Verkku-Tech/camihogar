"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface NavigationItem {
  id: string
  name: string
  href: string
  category: "main" | "configuration" | "inventory" | "orders"
  active: boolean
  description: string
}

interface NavigationContextType {
  navigationItems: NavigationItem[]
  updateNavigationItems: (items: NavigationItem[]) => void
  isNavigationItemActive: (id: string) => boolean
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

const defaultNavigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/",
    category: "main",
    active: true,
    description: "Panel principal con métricas y resumen",
  },
  {
    id: "pedidos-list",
    name: "Pedidos",
    href: "/pedidos",
    category: "orders",
    active: true,
    description: "Gestión de pedidos y presupuestos",
  },
  {
    id: "despachos",
    name: "Despachos",
    href: "/pedidos/despachos",
    category: "orders",
    active: true,
    description: "Gestión de pedidos listos para despachar",
  },
  {
    id: "proveedores",
    name: "Proveedores",
    href: "/proveedores",
    category: "main",
    active: true,
    description: "Gestión de proveedores",
  },
  {
    id: "clientes",
    name: "Clientes",
    href: "/clientes",
    category: "main",
    active: true,
    description: "Gestión de clientes",
  },
  {
    id: "tiendas",
    name: "Tiendas",
    href: "/tiendas",
    category: "main",
    active: true,
    description: "Gestión de tiendas",
  },
  {
    id: "reportes",
    name: "Reportes",
    href: "/reportes",
    category: "main",
    active: true,
    description: "Reportes y análisis",
  },
  {
    id: "categorias",
    name: "Categorías",
    href: "/inventario/categorias",
    category: "inventory",
    active: true,
    description: "Gestión de categorías de productos",
  },
  {
    id: "productos",
    name: "Productos",
    href: "/inventario/productos",
    category: "inventory",
    active: true,
    description: "Gestión de productos e inventario",
  },
  {
    id: "usuarios",
    name: "Usuarios",
    href: "/configuracion/usuarios",
    category: "configuration",
    active: true,
    description: "Gestión de usuarios del sistema",
  },
  {
    id: "navegacion",
    name: "Navegación",
    href: "/configuracion/navegacion",
    category: "configuration",
    active: true,
    description: "Configuración de menús de navegación",
  },
  {
    id: "tasas",
    name: "Tasas de Cambio",
    href: "/configuracion/tasas",
    category: "configuration",
    active: true,
    description: "Gestión de tasas de cambio para monedas (USD, EUR)",
  },
]

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>(defaultNavigationItems)

  useEffect(() => {
    const savedSettings = localStorage.getItem("camihogar-navigation-settings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setNavigationItems(parsed)
      } catch (error) {
        console.error("Error loading navigation settings:", error)
      }
    }
  }, [])

  const updateNavigationItems = (items: NavigationItem[]) => {
    setNavigationItems(items)
    localStorage.setItem("camihogar-navigation-settings", JSON.stringify(items))
  }

  const isNavigationItemActive = (id: string) => {
    const item = navigationItems.find((item) => item.id === id)
    return item?.active ?? true
  }

  return (
    <NavigationContext.Provider
      value={{
        navigationItems,
        updateNavigationItems,
        isNavigationItemActive,
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
