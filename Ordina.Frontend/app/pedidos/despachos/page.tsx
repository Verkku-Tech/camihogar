"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Search, Eye, Truck, CheckCircle, PackageCheck } from "lucide-react"
import { toast } from "sonner"
import { getUnifiedOrders, updateOrder, type UnifiedOrder } from "@/lib/storage"
import { useCurrency } from "@/contexts/currency-context"
import { useRouter } from "next/navigation"

const getStatusColor = (status: string) => {
  switch (status) {
    case "Por despachar":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Completada":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Generada":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Fabricación":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Generado":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

// Función helper para verificar si un pedido está listo para despachar
const isOrderReadyForDispatch = (order: UnifiedOrder): boolean => {
  // Solo pedidos tipo "order" (no presupuestos)
  if (order.type !== "order") return false

  // Verificar que tenga productos
  if (!order.products || order.products.length === 0) return false

  // Verificar que todos los productos estén listos
  return order.products.every((product) => {
    // Si está en tienda, está listo
    if (product.locationStatus === "en_tienda") {
      return true
    }

    // Si debe fabricarse, debe estar fabricado
    if (product.locationStatus === "mandar_a_fabricar") {
      return product.manufacturingStatus === "fabricado"
    }

    // Si no tiene locationStatus definido, asumir que no está listo
    return false
  })
}

export default function DespachosPage() {
  const { formatWithPreference, preferredCurrency } = useCurrency()
  const router = useRouter()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [orderToComplete, setOrderToComplete] = useState<UnifiedOrder | null>(null)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const [isBulkDispatchDialogOpen, setIsBulkDispatchDialogOpen] = useState(false)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setIsLoading(true)
        const allOrders = await getUnifiedOrders()
        // Filtrar solo pedidos listos para despachar (usando la función helper)
        const readyOrders = allOrders.filter(
          (order) => isOrderReadyForDispatch(order)
        )
        setOrders(readyOrders)
      } catch (error) {
        console.error("Error loading dispatch orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  // Actualizar totales cuando cambien los pedidos o la moneda preferida
  useEffect(() => {
    const updateTotals = async () => {
      const totals: Record<string, string> = {}
      for (const order of orders) {
        const formatted = await formatWithPreference(order.total, "Bs")
        totals[order.id] = formatted
      }
      setOrderTotals(totals)
    }
    if (orders.length > 0) {
      updateTotals()
    }
  }, [orders, preferredCurrency, formatWithPreference])

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Manejar selección individual
  const handleToggleSelect = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  // Manejar selección de todos
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleView = (order: UnifiedOrder) => {
    router.push(`/pedidos/${order.orderNumber}`)
  }

  // Despachar un pedido individual
  const handleCompleteDispatch = async () => {
    if (!orderToComplete) return

    try {
      // Actualizar el pedido a estado "Completada"
      await updateOrder(orderToComplete.id, {
        status: "Completada",
        dispatchDate: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })

      // Refrescar la lista
      const allOrders = await getUnifiedOrders()
      const readyOrders = allOrders.filter((order) => isOrderReadyForDispatch(order))
      setOrders(readyOrders)
      setIsCompleteDialogOpen(false)
      setOrderToComplete(null)
      setSelectedOrders((prev) => {
        const newSet = new Set(prev)
        newSet.delete(orderToComplete.id)
        return newSet
      })
      toast.success("Pedido marcado como completado")
    } catch (error) {
      console.error("Error completing dispatch:", error)
      toast.error("Error al completar el despacho. Por favor intenta nuevamente.")
    }
  }

  // Despachar múltiples pedidos
  const handleBulkDispatch = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Por favor selecciona al menos un pedido")
      return
    }

    try {
      const selectedOrderIds = Array.from(selectedOrders)
      let successCount = 0
      let errorCount = 0

      for (const orderId of selectedOrderIds) {
        try {
          await updateOrder(orderId, {
            status: "Completada",
            dispatchDate: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          })
          successCount++
        } catch (error) {
          console.error(`Error despachando pedido ${orderId}:`, error)
          errorCount++
        }
      }

      // Refrescar la lista
      const allOrders = await getUnifiedOrders()
      const readyOrders = allOrders.filter((order) => isOrderReadyForDispatch(order))
      setOrders(readyOrders)
      setSelectedOrders(new Set())
      setIsBulkDispatchDialogOpen(false)

      if (errorCount === 0) {
        toast.success(`${successCount} pedido(s) despachado(s) exitosamente`)
      } else {
        toast.warning(`${successCount} pedido(s) despachado(s), ${errorCount} error(es)`)
      }
    } catch (error) {
      console.error("Error en despacho masivo:", error)
      toast.error("Error al despachar los pedidos")
    }
  }

  const handleCompleteClick = (order: UnifiedOrder) => {
    setOrderToComplete(order)
    setIsCompleteDialogOpen(true)
  }

  const allSelected = filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length
  const someSelected = selectedOrders.size > 0 && selectedOrders.size < filteredOrders.length

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Pedidos</span>
              <span>/</span>
              <span>Despachos</span>
            </nav>

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar pedidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {selectedOrders.size > 0 && (
                  <Button
                    onClick={() => setIsBulkDispatchDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <PackageCheck className="w-4 h-4 mr-2" />
                    Despachar Seleccionados ({selectedOrders.size})
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Pedidos para Despachar
                  </CardTitle>
                  <CardDescription>
                    Lista de pedidos listos para ser despachados. Selecciona uno o varios para despachar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Cargando pedidos...</div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No se encontraron pedidos" : "No hay pedidos listos para despachar"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={handleSelectAll}
                              aria-label="Seleccionar todos"
                            />
                          </TableHead>
                          <TableHead>N° Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders.has(order.id)}
                                onCheckedChange={() => handleToggleSelect(order.id)}
                                aria-label={`Seleccionar pedido ${order.orderNumber}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell>{order.vendorName}</TableCell>
                            <TableCell>
                              {orderTotals[order.id] || `Bs.${order.total.toFixed(2)}`}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                            </TableCell>
                            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{order.products.length}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleView(order)}
                                  title="Ver detalles"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCompleteClick(order)}
                                  title="Despachar pedido"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Dialog de confirmación de completado individual */}
      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Completar despacho?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas marcar el pedido "{orderToComplete?.orderNumber}" como completado?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Cliente: {orderToComplete?.clientName} - Total: {orderToComplete ? (orderTotals[orderToComplete.id] || `Bs.${orderToComplete.total.toFixed(2)}`) : ""}
              </span>
              <br />
              <span className="text-sm font-medium text-green-600 mt-2 block">
                El pedido cambiará a estado "Completada".
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToComplete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCompleteDispatch}
              className="bg-green-600 hover:bg-green-700"
            >
              Completar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmación de despacho masivo */}
      <AlertDialog open={isBulkDispatchDialogOpen} onOpenChange={setIsBulkDispatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Despachar {selectedOrders.size} pedido(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas marcar {selectedOrders.size} pedido(s) como completados?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Los pedidos seleccionados cambiarán a estado "Completada".
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBulkDispatchDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDispatch}
              className="bg-green-600 hover:bg-green-700"
            >
              Despachar {selectedOrders.size} Pedido(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}

