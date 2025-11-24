"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, CheckCircle } from "lucide-react"
import { useNavigation } from "@/contexts/navigation-context"

export function NavigationPage() {
  const { navigationItems, updateNavigationItems } = useNavigation()
  const [localItems, setLocalItems] = useState(navigationItems)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    setLocalItems(navigationItems)
    setHasChanges(false)
  }, [navigationItems])

  const handleToggle = (id: string) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
    setHasChanges(true)
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

  const mainMenuItems = localItems.filter((item) => item.category === "main")
  const inventoryItems = localItems.filter((item) => item.category === "inventory")
  const configurationItems = localItems.filter((item) => item.category === "configuration")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración de Navegación</h1>
          <p className="text-muted-foreground">Gestiona la visibilidad de las opciones del menú</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restablecer
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
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

      {/* Main Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Menú Principal</CardTitle>
          <CardDescription>Controla la visibilidad de las opciones del menú principal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mainMenuItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{item.name}</h3>
                    <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Activo" : "Inactivo"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ruta: {item.href}</p>
                </div>
                <Switch checked={item.active} onCheckedChange={() => handleToggle(item.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inventory Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Menú de Inventario</CardTitle>
          <CardDescription>Controla la visibilidad de las opciones del submenú de inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {inventoryItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{item.name}</h3>
                    <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Activo" : "Inactivo"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ruta: {item.href}</p>
                </div>
                <Switch checked={item.active} onCheckedChange={() => handleToggle(item.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Menú de Configuración</CardTitle>
          <CardDescription>Controla la visibilidad de las opciones del submenú de configuración</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {configurationItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{item.name}</h3>
                    <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Activo" : "Inactivo"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ruta: {item.href}</p>
                </div>
                <Switch checked={item.active} onCheckedChange={() => handleToggle(item.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
