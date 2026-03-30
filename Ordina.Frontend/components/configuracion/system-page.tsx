"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/contexts/auth-context"
import {
  clearAllIndexedDBDataStores,
  getIndexedDBStoreStats,
} from "@/lib/storage"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

export function SystemPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getIndexedDBStoreStats()
      setStats(rows)
    } catch (e) {
      console.error(e)
      toast.error("No se pudieron leer las tablas de IndexedDB")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === "Super Administrator") {
      void loadStats()
    }
  }, [user?.role, loadStats])

  const handleClear = async () => {
    setClearing(true)
    setConfirmOpen(false)
    try {
      await clearAllIndexedDBDataStores()
      toast.success("Cache local (IndexedDB) limpiado. Los datos se volverán a cargar desde el servidor.")
      await loadStats()
    } catch (e) {
      console.error(e)
      toast.error("Error al limpiar IndexedDB")
    } finally {
      setClearing(false)
    }
  }

  if (user?.role !== "Super Administrator") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso denegado</CardTitle>
          <CardDescription>
            Solo el Super Administrador puede acceder a la configuración de sistema y mantenimiento de cache.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sistema</h1>
          <p className="text-muted-foreground">
            Herramientas de emergencia para el cache local del navegador (IndexedDB).
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Mantenimiento de cache local</CardTitle>
              <CardDescription>
                Limpia las tablas de datos en IndexedDB (categorías, productos, pedidos, etc.). No elimina la cola de
                sincronización ni la configuración de la app. Use solo si hay datos corruptos o desincronizados.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadStats()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Actualizar conteos</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando estadísticas…
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Tabla</th>
                      <th className="px-3 py-2 text-right font-medium">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row) => (
                      <tr key={row.name} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-mono text-xs">{row.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {row.count < 0 ? "—" : row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              variant="destructive"
              disabled={loading || clearing}
              onClick={() => setConfirmOpen(true)}
            >
              {clearing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Limpiar cache local (IndexedDB)
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar todo el cache local?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán los datos almacenados en IndexedDB en este navegador. La aplicación volverá a obtener los datos
              desde el servidor al navegar. La cola de sincronización offline no se elimina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleClear()
              }}
            >
              Sí, limpiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
