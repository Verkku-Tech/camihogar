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
  RectangleEllipsis,
  Sun,
  Moon,
  HelpCircle,
  User,
  LogOut,
  UserPen,
  Upload,
  Download,
} from "lucide-react"
import { usePwaInstall } from "@/components/pwa/install-prompt"
import { processAvatarImage } from "@/lib/image-utils"
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
import { Bell, AlertCircle, Info, AlertTriangle, Check, Trash2, Loader2 } from "lucide-react"
import { useNotifications } from "@/hooks/use-notifications"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { id: "home", name: "Inicio", href: "/", icon: Home },
  { id: "analytics", name: "Métricas", href: "/dashboard", icon: BarChart3, adminOnly: true },
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
  { id: "pin-acceso", name: "PIN de Acceso", href: "/configuracion/pin-acceso", icon: RectangleEllipsis, adminOnly: true },
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
  const { isNavigationItemActive, isNavigationItemVisible, navigationItems } = useNavigation()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { hasPermission, user, logout, updateUser } = useAuth()

  const router = useRouter()
  const { hasActiveExchangeRates } = useCurrency()
  const {
    notifications,
    unreadCount,
    isLoadingMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  } = useNotifications()
  const [isPinGeneratorOpen, setIsPinGeneratorOpen] = useState(false)
  const { canInstall, isStandalone, install } = usePwaInstall()

  const handleInstallPwa = async () => {
    if (canInstall) {
      await install()
    } else {
      const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        toast.info("Para instalar en iOS: presiona el botón Compartir en Safari y luego 'Añadir a pantalla de inicio'.")
      } else {
        toast.info("Para instalar en este dispositivo: usa el botón 'Instalar' en la barra de direcciones o menú del navegador.")
      }
    }
  }

  const canGenerateAccessPin =

    user?.role === "Super Administrator" || user?.role === "Administrator"

  const canEditUser =
    user?.role === "Super Administrator" ||
    user?.role === "Administrator" ||
    hasPermission("users.update")

  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editUsername, setEditUsername] = useState("")
  const [editAvatarUrl, setEditAvatarUrl] = useState("")
  const [isSavingUser, setIsSavingUser] = useState(false)

  useEffect(() => {
    if (isEditUserOpen && user) {
      setEditName(user.name || "")
      setEditEmail(user.email || "")
      setEditUsername(user.username || "")
      setEditAvatarUrl(user.avatarUrl || "")
    }
  }, [isEditUserOpen, user])

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!editName.trim()) {
      toast.error("El nombre completo es requerido")
      return
    }
    if (!editEmail.trim()) {
      toast.error("El correo electrónico es requerido")
      return
    }

    setIsSavingUser(true)
    try {
      const updated = await apiClient.updateUser(user.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        username: editUsername.trim() || undefined,
        avatarUrl: editAvatarUrl,
      })
      updateUser({
        name: updated.name,
        email: updated.email,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
      })
      toast.success("Usuario actualizado correctamente")
      setIsEditUserOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar el usuario")
    } finally {
      setIsSavingUser(false)
    }
  }

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
    const itemConfig = navigationItems.find((n) => n.id === item.id)
    const hasCustomRoleConfig = (itemConfig?.allowedRoles && itemConfig.allowedRoles.length > 0) || itemConfig?.superAdminOnly
    if (!hasCustomRoleConfig && 'adminOnly' in item && item.adminOnly) {
      if (user?.role !== 'Administrator' && user?.role !== 'Super Administrator') return false
    }
    return isNavigationItemVisible(item.id, user?.role) && checkPermission(item.id)
  });

  // Filter submenus
  const visibleOrdersSubmenu = ordersSubmenu.filter((item) => {
    const itemConfig = navigationItems.find((n) => n.id === item.id)
    const hasCustomRoleConfig = (itemConfig?.allowedRoles && itemConfig.allowedRoles.length > 0) || itemConfig?.superAdminOnly
    if (!hasCustomRoleConfig && 'adminOnly' in item && (item as any).adminOnly) {
      if (user?.role !== 'Administrator' && user?.role !== 'Super Administrator') return false
    }
    return isNavigationItemVisible(item.id, user?.role) && checkPermission(item.id)
  });

  const visibleInventorySubmenu = inventorySubmenu.filter((item) => {
    const itemConfig = navigationItems.find((n) => n.id === item.id)
    const hasCustomRoleConfig = (itemConfig?.allowedRoles && itemConfig.allowedRoles.length > 0) || itemConfig?.superAdminOnly
    if (!hasCustomRoleConfig && 'adminOnly' in item && (item as any).adminOnly) {
      if (user?.role !== 'Administrator' && user?.role !== 'Super Administrator') return false
    }
    return isNavigationItemVisible(item.id, user?.role) && checkPermission(item.id)
  });

  const visibleConfigurationSubmenu = configurationSubmenu.filter((item) => {
    const itemConfig = navigationItems.find((n) => n.id === item.id)
    const hasCustomRoleConfig = (itemConfig?.allowedRoles && itemConfig.allowedRoles.length > 0) || itemConfig?.superAdminOnly
    if (!hasCustomRoleConfig) {
      if ("adminOnly" in item && item.adminOnly) {
        const isAdmin =
          user?.role === "Super Administrator" || user?.role === "Administrator"
        if (!isAdmin) return false
      }
      if ("superAdminOnly" in item && item.superAdminOnly && user?.role !== "Super Administrator") {
        return false
      }
    }
    const perm = "permission" in item ? (item as { permission?: string }).permission : undefined
    return isNavigationItemVisible(item.id, user?.role) && checkPermission(item.id, perm)
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
            <Link href="/" className="flex items-center">
              <img
                src="/logos/Isologo.svg"
                alt="Forge"
                className="h-32 w-auto object-contain"
              />
            </Link>
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
                    {unreadCount > 0 ? (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-sidebar">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : !hasActiveExchangeRates ? (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-amber-500 rounded-full border-2 border-sidebar" />
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-80 md:w-96 mb-2 p-0 max-h-[480px] flex flex-col">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Notificaciones</span>
                      {unreadCount > 0 && (
                        <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">
                          {unreadCount} nuevas
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => markAllAsRead()}
                        >
                          Marcar todas leídas
                        </Button>
                      )}
                      {notifications.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAllNotifications()}
                          title="Eliminar todas las notificaciones"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div
                    className="overflow-y-auto max-h-[380px] divide-y divide-border"
                    onScroll={(e) => {
                      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
                      if (scrollHeight - scrollTop - clientHeight < 40) {
                        loadMore()
                      }
                    }}
                  >
                    {!hasActiveExchangeRates && (
                      <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-xs text-amber-800 dark:text-amber-200">
                            Tasa del día no configurada
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">
                            Se requiere al menos una tasa de cambio para conversiones.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push("/configuracion/tasas")}
                            className="w-full text-xs h-7"
                          >
                            Configurar Tasa
                          </Button>
                        </div>
                      </div>
                    )}

                    {notifications.length === 0 && hasActiveExchangeRates ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No tienes notificaciones pendientes
                      </div>
                    ) : (
                      <>
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "p-3 text-xs transition-colors hover:bg-muted/50 cursor-pointer flex gap-3 group relative",
                              !n.isRead && "bg-muted/30 font-medium"
                            )}
                            onClick={() => {
                              if (!n.isRead) markAsRead(n.id)
                              if (n.link) router.push(n.link)
                            }}
                          >
                            <div className="mt-0.5 shrink-0">
                              {n.severity === "error" ? (
                                <AlertCircle className="w-4 h-4 text-destructive" />
                              ) : n.severity === "warning" ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Info className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="truncate font-semibold text-foreground">
                                  {n.title}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {!n.isRead && (
                                    <button
                                      type="button"
                                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-80 hover:opacity-100"
                                      title="Marcar como leída"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        markAsRead(n.id)
                                      }}
                                    >
                                      <Check className="w-3.5 h-3.5 text-blue-500" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors opacity-80 hover:opacity-100"
                                    title="Eliminar notificación"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteNotification(n.id)
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  {!n.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-0.5" />
                                  )}
                                </div>
                              </div>
                              <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {isLoadingMore && (
                          <div className="p-2 flex items-center justify-center text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            <span className="text-[11px]">Cargando más notificaciones...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
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

              {!isStandalone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-500"
                  onClick={handleInstallPwa}
                  title="Instalar aplicación en este dispositivo"
                >
                  <Download className="w-4 h-4" />
                  <span className="sr-only">Instalar aplicación</span>
                </Button>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center w-full gap-3 px-2 py-2 text-sm font-medium rounded-md transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground shrink-0 border border-sidebar-border overflow-hidden">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || "Usuario"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
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
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm border border-border shrink-0 overflow-hidden shadow-xs">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || "Usuario"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate text-sm leading-tight">{user?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{user?.role}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              {!isStandalone && (
                <DropdownMenuItem
                  className="cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium"
                  onClick={handleInstallPwa}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Instalar aplicación
                </DropdownMenuItem>
              )}
              {canEditUser && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setIsEditUserOpen(true)}
                >
                  <UserPen className="mr-2 h-4 w-4" />
                  Editar usuario
                </DropdownMenuItem>
              )}
              {canGenerateAccessPin && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setIsPinGeneratorOpen(true)}
                >
                  <RectangleEllipsis className="mr-2 h-4 w-4" />
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
      {/* Edit User Dialog */}
      <Dialog
        open={isEditUserOpen}
        onOpenChange={(open) => {
          setIsEditUserOpen(open)
          if (!open && user) {
            setEditName(user.name || "")
            setEditEmail(user.email || "")
            setEditUsername(user.username || "")
            setEditAvatarUrl(user.avatarUrl || "")
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveEditUser}>
            <DialogHeader>
              <DialogTitle>Editar usuario</DialogTitle>
              <DialogDescription>
                Actualiza los datos y la foto de perfil de tu usuario.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              {/* Foto de Perfil */}
              <div className="flex flex-col items-center justify-center gap-2 p-3 bg-muted/40 rounded-lg border border-dashed border-border">
                <div className="relative">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt="Foto de perfil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-xs"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground border-2 border-dashed border-muted-foreground/30">
                      <User className="w-8 h-8 opacity-60" />
                    </div>
                  )}
                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl("")}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground p-1 rounded-full shadow-xs hover:bg-destructive/90 transition-colors"
                      title="Eliminar foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="sidebar-avatar-upload"
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    {editAvatarUrl ? "Cambiar foto" : "Subir foto"}
                  </label>
                  <input
                    id="sidebar-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const dataUrl = await processAvatarImage(file)
                        setEditAvatarUrl(dataUrl)
                        toast.success("Foto procesada y optimizada")
                      } catch (err: any) {
                        toast.error(err?.message || "Error al procesar la imagen")
                      }
                      e.target.value = ""
                    }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground text-center">
                  PNG, JPG o WebP. Se optimizará a 256x256 px automáticamente.
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sidebar-edit-name">Nombre Completo *</Label>
                <Input
                  id="sidebar-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sidebar-edit-username">Nombre de Usuario *</Label>
                <Input
                  id="sidebar-edit-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sidebar-edit-email">Correo Electrónico *</Label>
                <Input
                  id="sidebar-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditUserOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingUser}>
                {isSavingUser ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
