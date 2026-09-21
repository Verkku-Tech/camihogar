"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, CheckCircle, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react"
import { useNavigation } from "@/contexts/navigation-context"

export function NavigationPage() {
  const { navigationItems, updateNavigationItems } = useNavigation()
  const [localItems, setLocalItems] = useState(navigationItems)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // ponytail: Categorías colapsadas por defecto
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    main: false,
    inventory: false,
    orders: false,
    configuration: false,
  })

  useEffect(() => {
    setLocalItems(navigationItems)
    setHasChanges(false)
  }, [navigationItems])

  const handleToggle = (id: string) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
    setHasChanges(true)
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

  const handleSave = () => {
    updateNavigationItems(localItems)
    setHasChanges(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
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
          <h1 className="text-2xl font-bold text-foreground">Configuración de Navegación</h1>
          <p className="text-muted-foreground">Gestiona la visibilidad de las opciones del menú</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            <ChevronsUpDown className="w-4 h-4 mr-2" />
            {allOpen ? "Colapsar todo" : "Expandir todo"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <p className="text-sm text-green-800 dark:text-green-200">
              Configuración de navegación guardada exitosamente.
            </p>
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Tienes cambios sin guardar. No olvides guardar para aplicar los cambios.
          </p>
        </div>
      )}

      {/* Categorías de navegación colapsables */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const activeCount = cat.items.filter((item) => item.active).length
          const isOpen = !!openCategories[cat.id]

          return (
            <Card key={cat.id} className="transition-all duration-200 overflow-hidden">
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
                className="cursor-pointer select-none flex flex-row items-center justify-between space-y-0 py-4 hover:bg-muted/40 transition-colors"
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
                <CardContent className="pt-2 border-t">
                  <div className="space-y-3">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{item.name}</h3>
                            <Badge variant={item.active ? "default" : "secondary"}>
                              {item.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">Ruta: {item.href}</p>
                        </div>
                        <Switch checked={item.active} onCheckedChange={() => handleToggle(item.id)} />
                      </div>
                    ))}
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
