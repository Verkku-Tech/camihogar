"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Home,
  ShoppingCart,
  Package,
  Settings,
  BarChart3,
  BarChart2,
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
  ClipboardList,
  CreditCard,
  Percent,
  Shield,
  Database,
  KeyRound,
  Sun,
  Moon,
  HelpCircle,
  User,
  LogOut,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useNavigation } from "@/contexts/navigation-context"
import { useAuth } from "@/contexts/auth-context"
import { useCurrency } from "@/contexts/currency-context"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { PinGeneratorDialog } from "@/components/pin/pin-generator-dialog"
import { Bell, AlertCircle } from "lucide-react"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { id: "home", name: "Home", href: "/", icon: Home },
  { id: "analytics", name: "Dashboard", href: "/dashboard", icon: BarChart3, adminOnly: true },
  { id: "proveedores", name: "Proveedores", href: "/proveedores", icon: Users },
  { id: "clientes", name: "Clientes", href: "/clientes", icon: UserCheck },
  { id: "tiendas", name: "Tiendas", href: "/tiendas", icon: Building2 },
  { id: "cuentas", name: "Cuentas", href: "/cuentas", icon: CreditCard },
  { id: "reportes", name: "Reportes", href: "/reportes", icon: BarChart2 },
]

const ordersSubmenu = [
  { id: "pedidos-list", name: "Pedidos", href: "/pedidos", icon: ShoppingCart },
  { id: "reservas", name: "Reservas", href: "/pedidos/reservas", icon: ClipboardList },
  { id: "fabricacion", name: "Fabricación", href: "/pedidos/fabricacion", icon: Package },
  { id: "despachos", name: "Despachos", href: "/pedidos/despachos", icon: Truck },
  { id: "abbaco", name: "Abbaco (migración)", href: "/abbaco", icon: Database },
]

const inventorySubmenu = [
  { id: "categorias", name: "Categorías", href: "/inventario/categorias", icon: Tags },
  { id: "productos", name: "Productos", href: "/inventario/productos", icon: Box },
]

const configurationSubmenu = [
  { id: "usuarios", name: "Usuarios", href: "/configuracion/usuarios", icon: Users },
  { id: "navegacion", name: "Navegación", href: "/configuracion/navegacion", icon: Navigation },
  { id: "tasas", name: "Tasas de Cambio", href: "/configuracion/tasas", icon: DollarSign },
  { id: "comisiones", name: "Comisiones", href: "/configuracion/comisiones", icon: Percent, permission: "settings.company.manage" },
  { id: "roles", name: "Roles y Permisos", href: "/configuracion/roles", icon: Shield, permission: "roles.read" },
  { id: "pin-acceso", name: "PIN de Acceso", href: "/configuracion/pin-acceso", icon: KeyRound, adminOnly: true },
  { id: "sistema", name: "Sistema", href: "/configuracion/sistema", icon: Database },
]

const permissionMap: Record<string, string | string[] | { adminOnly: boolean }> = {
  "home": [],           // Todos los roles
  "analytics": { adminOnly: true }, // Solo Admin / Super Admin
  "proveedores": "providers.read",
  "clientes": "clients.read",
  "tiendas": "settings.company.manage", // Only admins manage stores
  "cuentas": "finance.accounts.read",
  "reportes": ["reports.dispatch.view", "reports.commissions.view", "reports.manufacturing.view", "reports.payments.detailed.view"], // Show if any
  "pedidos-list": "orders.read",
  "reservas": "orders.read",
  "despachos": "dispatch.read",
  "abbaco": "orders.read",
  "categorias": "products.read",
  "productos": "products.read",
  "fabricacion": ["inventory.movements.view", "manufacturing.manage"],
  "usuarios": "users.read",
  "navegacion": "settings.system.manage",
  "tasas": "settings.currency.manage",
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const isFabricacionPage = pathname.startsWith("/pedidos/fabricacion") || pathname.startsWith("/inventario/fabricacion")
  const isInventorySectionPath =
    pathname.startsWith("/inventario") && !pathname.startsWith("/inventario/fabricacion")
  const [configOpen, setConfigOpen] = useState(pathname.startsWith("/configuracion"))
  const [inventoryOpen, setInventoryOpen] = useState(isInventorySectionPath)
  const [ordersOpen, setOrdersOpen] = useState(
    pathname.startsWith("/pedidos") || isFabricacionPage,
  )
  const { isNavigationItemActive } = useNavigation()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { hasPermission, user, logout } = useAuth()

  const router = useRouter()
  const { hasActiveExchangeRates } = useCurrency()
  const [isPinGeneratorOpen, setIsPinGeneratorOpen] = useState(false)

  const canGenerateAccessPin =
    user?.role === "Super Administrator" || user?.role === "Administrator"

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setInventoryOpen(isInventorySectionPath)
    setOrdersOpen(pathname.startsWith("/pedidos") || pathname.startsWith("/inventario/fabricacion"))
  }, [pathname, isInventorySectionPath])

  const toggleTheme = () => {
    const currentTheme = theme === "dark" ? "dark" : "light"
    setTheme(currentTheme === "light" ? "dark" : "light")
  }

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) {
      toast.error("Las contraseñas nuevas no coinciden")
      return
    }
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres")
      return
    }
    setIsChangingPassword(true)
    try {
      await apiClient.changePassword(currentPassword, newPassword)
      toast.success("Contraseña actualizada correctamente")
      setIsChangePasswordOpen(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al cambiar la contraseña"
      toast.error(message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const checkPermission = (id: string, itemPermission?: string) => {
    // home is always allowed
    if (id === "home" || id === "dashboard") return true;

    // Check adminOnly in permissionMap
    const required = permissionMap[id];
    if (required && typeof required === 'object' && !Array.isArray(required) && 'adminOnly' in required) {
      return user?.role === "Super Administrator" || user?.role === "Administrator";
    }

    // Check specific permission in item if exists
    if (itemPermission) {
      return hasPermission(itemPermission);
    }

    if (!required) return true;
    if (Array.isArray(required)) {
      if (required.length === 0) return true;
      return required.some(p => hasPermission(p as string));
    }
    return hasPermission(required as string);
  }

  const visibleNavigation = navigation.filter((item) => {
    if ('adminOnly' in item && item.adminOnly) {
      if (user?.role !== 'Administrator' && user?.role !== 'Super Administrator') return false
    }
    return isNavigationItemActive(item.id) && checkPermission(item.id)
  });

  // Filter submenus
  const visibleOrdersSubmenu = ordersSubmenu.filter((item) => isNavigationItemActive(item.id) && checkPermission(item.id));
  const visibleInventorySubmenu = inventorySubmenu.filter((item) => isNavigationItemActive(item.id) && checkPermission(item.id));

  const visibleConfigurationSubmenu = configurationSubmenu.filter((item) => {
    if ("adminOnly" in item && item.adminOnly) {
      const isAdmin =
        user?.role === "Super Administrator" || user?.role === "Administrator"
      if (!isAdmin) return false
    }
    if ("superAdminOnly" in item && item.superAdminOnly && user?.role !== "Super Administrator") {
      return false
    }
    const perm = "permission" in item ? (item as { permission?: string }).permission : undefined
    return isNavigationItemActive(item.id) && checkPermission(item.id, perm)
  })

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => onOpenChange(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col justify-between h-full",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border shrink-0">
            <h1 className="text-xl font-bold text-sidebar-foreground">Ordina</h1>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
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
                      isInventorySectionPath
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
                      pathname.startsWith("/pedidos") || isFabricacionPage
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

        {/* Sidebar Footer: Preferences & User profile */}
        <div className="p-3 border-t border-sidebar-border flex flex-col gap-2 shrink-0 bg-sidebar">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground">Preferencias</span>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative"
                    title="Notificaciones"
                  >
                    <Bell className="h-4 w-4" />
                    {!hasActiveExchangeRates && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border-2 border-sidebar" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-80 mb-2">
                  {!hasActiveExchangeRates ? (
                    <div className="px-3 py-2">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-1">
                            No hay tasas de cambio configuradas
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                            Es necesario crear al menos una tasa de cambio (USD o EUR) para poder
                            realizar conversiones de moneda en pedidos y presupuestos.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => router.push("/configuracion/tasas")}
                            className="w-full"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Ir a Tasas de Cambio
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No hay notificaciones
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative"
                onClick={toggleTheme}
                title={mounted && theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Cambiar tema</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Ayuda"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="sr-only">Ayuda</span>
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center w-full gap-3 px-2 py-2 text-sm font-medium rounded-md transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground shrink-0 border border-sidebar-border">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.name || user?.email || "Usuario"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role || ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-56 z-[9999] mb-2"
              sideOffset={8}
            >
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{user?.name}</div>
                <div className="truncate text-xs">{user?.email}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{user?.role}</div>
              </div>
              <DropdownMenuSeparator />
              {canGenerateAccessPin && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setIsPinGeneratorOpen(true)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Generar PIN de acceso
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setIsChangePasswordOpen(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Cambiar contraseña
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={logout}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PinGeneratorDialog open={isPinGeneratorOpen} onOpenChange={setIsPinGeneratorOpen} />

      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={(open) => {
          setIsChangePasswordOpen(open)
          if (!open) {
            setCurrentPassword("")
            setNewPassword("")
            setConfirmNewPassword("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleChangePasswordSubmit}>
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription>
                Introduce tu contraseña actual y la nueva contraseña que deseas usar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sidebar-current-password">Contraseña actual</Label>
                <Input
                  id="sidebar-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-new-password">Nueva contraseña</Label>
                <Input
                  id="sidebar-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-confirm-new-password">Confirmar nueva contraseña</Label>
                <Input
                  id="sidebar-confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChangePasswordOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
