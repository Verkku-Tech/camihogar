"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Save,
  RotateCcw,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Shield,
  Lock,
  Users,
  AlertCircle,
} from "lucide-react"
import { useNavigation, type NavigationItem } from "@/contexts/navigation-context"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api-client"

const DEFAULT_SYSTEM_ROLES = [
  "Super Administrator",
  "Administrator",
  "Supervisor",
  "Store Seller",
  "Workshop Operator",
  "Logistics Operator",
]

export function NavigationPage() {
  const { navigationItems, updateNavigationItems } = useNavigation()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === "Super Administrator"

  const [localItems, setLocalItems] = useState<NavigationItem[]>(navigationItems)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [availableRoles, setAvailableRoles] = useState<string[]>(DEFAULT_SYSTEM_ROLES)
  const [expandedItemRoles, setExpandedItemRoles] = useState<Record<string, boolean>>({})

  // ponytail: Categorías colapsadas por defecto
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    main: true,
    inventory: false,
    orders: false,
    configuration: false,
  })

  useEffect(() => {
    setLocalItems(navigationItems)
    setHasChanges(false)
  }, [navigationItems])

  // Cargar lista de roles del backend si es Superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      apiClient
        .getRoles()
        .then((res) => {
          const names = res.map((r) => r.name).filter(Boolean)
          if (names.length > 0) {
            setAvailableRoles(names)
          }
        })
        .catch(() => {
          // ponytail: fallback silencioso a roles por defecto del sistema
        })
    }
  }, [isSuperAdmin])

  const handleToggleActive = (id: string) => {
    setLocalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    )
    setHasChanges(true)
  }

  const handleToggleSuperAdminOnly = (id: string) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const nextState = !item.superAdminOnly
        return {
          ...item,
          superAdminOnly: nextState,
        }
      })
    )
    setHasChanges(true)
  }

  const handleToggleRoleForOption = (itemId: string, roleName: string) => {
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const currentRoles = item.allowedRoles || []
        const exists = currentRoles.includes(roleName)
        const nextRoles = exists
          ? currentRoles.filter((r) => r !== roleName)
          : [...currentRoles, roleName]
        return {
          ...item,
          allowedRoles: nextRoles,
        }
      })
    )
    setHasChanges(true)
  }

  const toggleItemRolesExpansion = (id: string) => {
    setExpandedItemRoles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const allOpen = Object.values(openCategories).every(Boolean)

  const toggleAll = () => {
    const nextState = !allOpen
    setOpenCategories({
      main: nextState,
      inventory: nextState,
      orders: nextState,
      configuration: nextState,
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateNavigationItems(localItems)
      setHasChanges(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setLocalItems(navigationItems)
    setHasChanges(false)
  }

  const categories = [
    {
      id: "main",
      title: "Menú Principal",
      description: "Controla la visibilidad de las opciones del menú principal",
      items: localItems.filter((item) => item.category === "main"),
    },
    {
      id: "inventory",
      title: "Menú de Inventario",
      description: "Controla la visibilidad de las opciones del submenú de inventario",
      items: localItems.filter((item) => item.category === "inventory"),
    },
    {
      id: "orders",
      title: "Menú de Pedidos",
      description: "Controla la visibilidad de las opciones del submenú de pedidos",
      items: localItems.filter((item) => item.category === "orders"),
    },
    {
      id: "configuration",
      title: "Menú de Configuración",
      description: "Controla la visibilidad de las opciones del submenú de configuración",
      items: localItems.filter((item) => item.category === "configuration"),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Configuración de Navegación</h1>
            {isSuperAdmin && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-700 text-xs gap-1">
                <Shield className="w-3 h-3" /> Modo Superadmin
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gestiona la visibilidad global y por roles de las opciones del menú.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            <ChevronsUpDown className="w-4 h-4 mr-2" />
            {allOpen ? "Colapsar todo" : "Expandir todo"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges || isSaving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 transition-all">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mr-2 shrink-0" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Configuración de navegación guardada exitosamente y sincronizada con el sistema.
            </p>
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Tienes cambios sin guardar. Haz clic en "Guardar Cambios" para aplicar la nueva visibilidad de navegación en toda la aplicación.
          </p>
        </div>
      )}

      {/* Categorías de navegación colapsables */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const activeCount = cat.items.filter((item) => item.active).length
          const isOpen = !!openCategories[cat.id]

          return (
            <Card key={cat.id} className="transition-all duration-200 overflow-hidden border-border/80 shadow-sm">
              <CardHeader
                role="button"
                tabIndex={0}
                onClick={() => toggleCategory(cat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleCategory(cat.id)
                  }
                }}
                className="cursor-pointer select-none flex flex-row items-center justify-between space-y-0 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{cat.title}</CardTitle>
                    <Badge variant="outline" className="text-xs font-normal">
                      {activeCount} de {cat.items.length} activos
                    </Badge>
                  </div>
                  <CardDescription>{cat.description}</CardDescription>
                </div>
                <div className="flex items-center text-muted-foreground ml-4">
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 transition-transform" />
                  ) : (
                    <ChevronRight className="w-5 h-5 transition-transform" />
                  )}
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="pt-3 border-t">
                  <div className="space-y-3">
                    {cat.items.map((item) => {
                      const isItemRolesOpen = !!expandedItemRoles[item.id]
                      const allowedCount = item.allowedRoles?.length || 0

                      return (
                        <div
                          key={item.id}
                          className="border rounded-xl bg-card hover:bg-muted/10 transition-colors overflow-hidden"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-foreground">{item.name}</h3>
                                <Badge variant={item.active ? "default" : "secondary"} className="text-xs">
                                  {item.active ? "Activo" : "Inactivo"}
                                </Badge>
                                {item.superAdminOnly && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 flex items-center gap-1"
                                  >
                                    <Lock className="w-3 h-3" /> Solo Superadmin
                                  </Badge>
                                )}
                                {!item.superAdminOnly && allowedCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700 flex items-center gap-1"
                                  >
                                    <Users className="w-3 h-3" /> {allowedCount} rol{allowedCount > 1 ? "es" : ""}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              <p className="text-xs text-muted-foreground/80 mt-1 font-mono">
                                Ruta: {item.href}
                              </p>
                            </div>

                            {/* Controles de visibilidad */}
                            <div className="flex items-center gap-4 shrink-0">
                              {isSuperAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleItemRolesExpansion(item.id)}
                                  className="text-xs h-8 text-muted-foreground hover:text-foreground"
                                >
                                  <Users className="w-3.5 h-3.5 mr-1.5" />
                                  Roles
                                  {isItemRolesOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                  )}
                                </Button>
                              )}
                              <div className="flex items-center gap-2 pl-2 border-l border-border/60">
                                <span className="text-xs text-muted-foreground sm:hidden">Activo:</span>
                                <Switch
                                  id={`switch-${item.id}`}
                                  checked={item.active}
                                  onCheckedChange={() => handleToggleActive(item.id)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Panel de configuración de roles exclusivo para Superadmin */}
                          {isSuperAdmin && isItemRolesOpen && (
                            <div className="bg-muted/30 border-t p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40">
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                    Control de Acceso por Roles (Superadmin)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-lg border">
                                  <label
                                    htmlFor={`superadmin-only-${item.id}`}
                                    className="text-xs font-medium cursor-pointer select-none"
                                  >
                                    Ocultar para todos excepto Superadmin
                                  </label>
                                  <Switch
                                    id={`superadmin-only-${item.id}`}
                                    checked={!!item.superAdminOnly}
                                    onCheckedChange={() => handleToggleSuperAdminOnly(item.id)}
                                  />
                                </div>
                              </div>

                              {item.superAdminOnly ? (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span>
                                    Opción en desarrollo/restringida: <strong>Solo el Super Administrador</strong> podrá ver y acceder a "{item.name}". Ningún otro rol la verá en la navegación ni podrá entrar a {item.href}.
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Selecciona qué roles tienen permitido ver esta opción. Si no marcas ningún rol, estará disponible para todos los roles autorizados por los permisos estándar.
                                  </p>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {availableRoles.map((role) => {
                                      const isSuperAdminRole = role === "Super Administrator"
                                      const isAllowed = isSuperAdminRole || (item.allowedRoles || []).includes(role)

                                      return (
                                        <button
                                          key={role}
                                          type="button"
                                          disabled={isSuperAdminRole}
                                          onClick={() => handleToggleRoleForOption(item.id, role)}
                                          className={`text-xs px-2.5 py-1 rounded-md border transition-all select-none flex items-center gap-1.5 ${
                                            isAllowed
                                              ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                                              : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:bg-muted/50"
                                          } ${isSuperAdminRole ? "opacity-80 cursor-default" : "cursor-pointer"}`}
                                        >
                                          {isAllowed ? "✓" : "+"} {role}
                                          {isSuperAdminRole && " (Siempre)"}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
