"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Home,
  ShoppingCart,
  Package,
  Settings,
  BarChart3,
  X,
  Users,
  Building2,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Navigation,
  Tags,
  Box,
  DollarSign,
  Truck,
  CreditCard,
  Percent,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useNavigation } from "@/contexts/navigation-context"
import { useAuth } from "@/contexts/auth-context"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { id: "dashboard", name: "Dashboard", href: "/", icon: Home },
  { id: "proveedores", name: "Proveedores", href: "/proveedores", icon: Users },
  { id: "clientes", name: "Clientes", href: "/clientes", icon: UserCheck },
  { id: "tiendas", name: "Tiendas", href: "/tiendas", icon: Building2 },
  { id: "cuentas", name: "Cuentas", href: "/cuentas", icon: CreditCard },
  { id: "reportes", name: "Reportes", href: "/reportes", icon: BarChart3 },
]

const ordersSubmenu = [
  { id: "pedidos-list", name: "Pedidos", href: "/pedidos", icon: ShoppingCart },
  { id: "despachos", name: "Despachos", href: "/pedidos/despachos", icon: Truck },
]

const inventorySubmenu = [
  { id: "categorias", name: "Categorías", href: "/inventario/categorias", icon: Tags },
  { id: "productos", name: "Productos", href: "/inventario/productos", icon: Box },
  { id: "fabricacion", name: "Fabricación", href: "/inventario/fabricacion", icon: Package },
]

const configurationSubmenu = [
  { id: "usuarios", name: "Usuarios", href: "/configuracion/usuarios", icon: Users },
  { id: "navegacion", name: "Navegación", href: "/configuracion/navegacion", icon: Navigation },
  { id: "tasas", name: "Tasas de Cambio", href: "/configuracion/tasas", icon: DollarSign },
  { id: "comisiones", name: "Comisiones", href: "/configuracion/comisiones", icon: Percent, permission: "settings.company.manage" },
  { id: "roles", name: "Roles y Permisos", href: "/configuracion/roles", icon: Shield, permission: "roles.read" },
]

const permissionMap: Record<string, string | string[]> = {
  "dashboard": [], // Public
  "proveedores": "providers.read",
  "clientes": "clients.read",
  "tiendas": "settings.company.manage", // Only admins manage stores
  "cuentas": "finance.accounts.read",
  "reportes": ["reports.dispatch.view", "reports.commissions.view", "reports.manufacturing.view", "reports.payments.detailed.view"], // Show if any
  "pedidos-list": "orders.read",
  "despachos": "dispatch.read",
  "categorias": "products.read",
  "productos": "products.read",
  "fabricacion": "inventory.movements.view",
  "usuarios": "users.read",
  "navegacion": "settings.system.manage",
  "tasas": "settings.currency.manage",
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const [configOpen, setConfigOpen] = useState(pathname.startsWith("/configuracion"))
  const [inventoryOpen, setInventoryOpen] = useState(pathname.startsWith("/inventario"))
  const [ordersOpen, setOrdersOpen] = useState(pathname.startsWith("/pedidos"))
  const { isNavigationItemActive } = useNavigation()
  const { hasPermission, user } = useAuth()

  const checkPermission = (id: string, itemPermission?: string) => {
    // If it's the dashboard, it's always allowed
    if (id === "dashboard") return true;

    // Check specific permission in item if exists
    if (itemPermission) {
      return hasPermission(itemPermission);
    }

    // Check in map
    const required = permissionMap[id];
    if (!required) return true; // Default allow if not mapped? Or deny? Let's say allow for now unless mapped.
    // Actually better to be strict? No, let's be mapped-based.

    if (Array.isArray(required)) {
      if (required.length === 0) return true;
      return required.some(p => hasPermission(p));
    }

    return hasPermission(required);
  }

  const visibleNavigation = navigation.filter((item) => isNavigationItemActive(item.id) && checkPermission(item.id));

  // Filter submenus
  const visibleOrdersSubmenu = ordersSubmenu.filter((item) => isNavigationItemActive(item.id) && checkPermission(item.id));
  const visibleInventorySubmenu = inventorySubmenu.filter((item) => isNavigationItemActive(item.id) && checkPermission(item.id));

  // Configuration submenu has permissions directly in the array as well?
  // Let's use the checkPermission function which handles both (if we added permission prop to items above)
  // For configuration, we updated the array to include 'permission' prop.
  // But wait, I only updated configurationSubmenu in the chunk above. I need to update checkPermission to handle the item object or pass permission.

  const visibleConfigurationSubmenu = configurationSubmenu.filter((item) => {
    // @ts-ignore
    const perm = item.permission;
    return isNavigationItemActive(item.id) && checkPermission(item.id, perm);
  });

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => onOpenChange(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">Ordina</h1>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {visibleNavigation.filter((item) => item.id !== "reportes").map((item) => {
              const isCurrent = pathname === item.href

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isCurrent
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                </li>
              )
            })}

            {visibleInventorySubmenu.length > 0 && (
              <li>
                <button
                  onClick={() => setInventoryOpen(!inventoryOpen)}
                  className={cn(
                    "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith("/inventario")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Package className="w-5 h-5 mr-3" />
                  Inventario
                  {inventoryOpen ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>

                {inventoryOpen && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {visibleInventorySubmenu.map((item) => {
                      const isCurrent = pathname === item.href

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                              isCurrent
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            {item.name}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )}

            {visibleOrdersSubmenu.length > 0 && (
              <li>
                <button
                  onClick={() => setOrdersOpen(!ordersOpen)}
                  className={cn(
                    "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith("/pedidos")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <ShoppingCart className="w-5 h-5 mr-3" />
                  Pedidos
                  {ordersOpen ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>

                {ordersOpen && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {visibleOrdersSubmenu.map((item) => {
                      const isCurrent = pathname === item.href

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                              isCurrent
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            {item.name}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )}

            {visibleNavigation.filter((item) => item.id === "reportes").map((item) => {
              const isCurrent = pathname === item.href

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isCurrent
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                </li>
              )
            })}


            {visibleConfigurationSubmenu.length > 0 && (
              <li>
                <button
                  onClick={() => setConfigOpen(!configOpen)}
                  className={cn(
                    "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith("/configuracion")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Configuración
                  {configOpen ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>

                {configOpen && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {visibleConfigurationSubmenu.map((item) => {
                      const isCurrent = pathname === item.href

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                              isCurrent
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            {item.name}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>
      </div>
    </>
  )
}
