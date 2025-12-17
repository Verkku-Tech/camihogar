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
import { NewOrderDialog } from "@/components/orders/new-order-dialog"
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
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getUnifiedOrders, deleteOrder, deleteBudget, type UnifiedOrder } from "@/lib/storage"
import { useCurrency } from "@/contexts/currency-context"

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Generado":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    case "Generada":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Fabricación":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Por despachar":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Completada":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

export default function PedidosPage() {
  const { formatWithPreference, preferredCurrency } = useCurrency()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderToDelete, setOrderToDelete] = useState<UnifiedOrder | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setIsLoading(true)
        const loadedOrders = await getUnifiedOrders()
        setOrders(loadedOrders)
      } catch (error) {
        console.error("Error loading orders:", error)
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
        // Los totales de pedidos se guardan siempre en Bs
        const formatted = await formatWithPreference(order.total, "Bs")
        totals[order.id] = formatted
      }
      setOrderTotals(totals)
    }
    if (orders.length > 0) {
      updateTotals()
    }
  }, [orders, preferredCurrency, formatWithPreference])

  // Función para refrescar después de crear un pedido
  const handleOrderCreated = async () => {
    const loadedOrders = await getUnifiedOrders()
    setOrders(loadedOrders)
    setIsNewOrderOpen(false)
  }

  // Obtener total formateado para el pedido a eliminar
  const getDeleteOrderTotal = () => {
    if (!orderToDelete) return ""
    return orderTotals[orderToDelete.id] || `Bs.${orderToDelete.total.toFixed(2)}`
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDelete = async () => {
    if (!orderToDelete) return

    try {
      // Eliminar según el tipo (pedido o presupuesto)
      if (orderToDelete.type === "order") {
        await deleteOrder(orderToDelete.id)
      } else {
        await deleteBudget(orderToDelete.id)
      }
      // Refrescar la lista de pedidos
      const loadedOrders = await getUnifiedOrders()
      setOrders(loadedOrders)
      setIsDeleteDialogOpen(false)
      setOrderToDelete(null)
      toast.success("Eliminado exitosamente")
    } catch (error) {
      console.error("Error deleting order:", error)
      toast.error("Error al eliminar. Por favor intenta nuevamente.")
    }
  }

  const handleView = async (order: UnifiedOrder) => {
    // Redirigir según el tipo (pedido o presupuesto)
    if (order.type === "order") {
      window.location.href = `/pedidos/${order.orderNumber}`
    } else {
      window.location.href = `/presupuestos/${order.orderNumber}`
    }
  }

  const handleEdit = (order: UnifiedOrder) => {
    // TODO: Implementar edición del pedido
    console.log("Editar pedido:", order)
    toast.info(`Editar ${order.type === "order" ? "pedido" : "presupuesto"} ${order.orderNumber}`, {
      description: "Esta funcionalidad será implementada próximamente.",
    })
  }

  const handleDeleteClick = (order: UnifiedOrder) => {
    setOrderToDelete(order)
    setIsDeleteDialogOpen(true)
  }

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
                <Button onClick={() => setIsNewOrderOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Pedido
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lista de Pedidos</CardTitle>
                  <CardDescription>Gestiona todos los pedidos del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Cargando pedidos...</div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No se encontraron pedidos" : "No hay pedidos registrados"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Método de Pago</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell>{order.vendorName}</TableCell>
                            <TableCell>
                              {orderTotals[order.id] || `Bs.${order.total.toFixed(2)}`}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                            </TableCell>
                            <TableCell>{order.paymentMethod || (order.type === "budget" ? "N/A" : "-")}</TableCell>
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
                                  onClick={() => handleEdit(order)}
                                  title="Editar pedido"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(order)}
                                  title="Eliminar pedido"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                  <Trash2 className="w-4 h-4" />
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

      <NewOrderDialog 
        open={isNewOrderOpen} 
        onOpenChange={(open) => {
          setIsNewOrderOpen(open)
          if (!open) {
            // Refrescar cuando se cierra el diálogo
            handleOrderCreated()
          }
        }}
      />

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {orderToDelete?.type === "order" ? "pedido" : "presupuesto"}?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el {orderToDelete?.type === "order" ? "pedido" : "presupuesto"} "{orderToDelete?.orderNumber}"?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Cliente: {orderToDelete?.clientName} - Total: {getDeleteOrderTotal()}
              </span>
              <br />
              <span className="text-sm font-medium text-red-600 mt-2 block">
                Esta acción no se puede deshacer.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}
