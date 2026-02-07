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
import { Search, Plus, Eye, Edit, Trash2, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getUnifiedOrders, deleteOrder, deleteBudget, type UnifiedOrder } from "@/lib/storage"
import { useCurrency } from "@/contexts/currency-context"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"
import { ORDER_STATUSES, PAYMENT_METHODS_FILTER } from "@/components/orders/constants"

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Por Fabricar":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "En Fabricación":
    case "Fabricación":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Despacho":
    case "Por despachar":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Entregado":
    case "Completada":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Declinado":
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    case "Generado":
    case "Generada":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

export default function PedidosPage() {
  const { formatWithPreference, preferredCurrency } = useCurrency()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState({
    vendor: "all",
    status: "all",
    paymentMethod: "all",
    client: "all",
  })
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderToDelete, setOrderToDelete] = useState<UnifiedOrder | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})
  const [itemsPerPage, setItemsPerPage] = useState(10)

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

  // Obtener valores únicos para los filtros
  const uniqueVendors = Array.from(new Set(orders.map((o) => o.vendorName))).sort()
  const uniqueClients = Array.from(new Set(orders.map((o) => o.clientName))).sort()
  
  // Usar lista fija de estados y métodos de pago
  const uniqueStatuses = ORDER_STATUSES.map(s => s.value)
  const uniquePaymentMethods = [...PAYMENT_METHODS_FILTER]

  const filteredOrders = orders.filter((order) => {
    // Filtro de búsqueda general (existente)
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtros por columna
    const matchesVendor = filters.vendor === "all" || order.vendorName === filters.vendor
    const matchesStatus = filters.status === "all" || order.status === filters.status
    const matchesPaymentMethod =
      filters.paymentMethod === "all" || order.paymentMethod === filters.paymentMethod
    const matchesClient = filters.client === "all" || order.clientName === filters.client

    return matchesSearch && matchesVendor && matchesStatus && matchesPaymentMethod && matchesClient
  })

  // Paginación
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedOrders,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({
    data: filteredOrders,
    itemsPerPage,
  })

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

              {/* Filtros por columna */}
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={filters.client}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, client: value }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {uniqueClients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.vendor}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, vendor: value }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos los vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los vendedores</SelectItem>
                    {uniqueVendors.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {uniqueStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.paymentMethod}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, paymentMethod: value }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos los métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los métodos</SelectItem>
                    {uniquePaymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(filters.client !== "all" || filters.vendor !== "all" || filters.status !== "all" || filters.paymentMethod !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters({ client: "all", vendor: "all", status: "all", paymentMethod: "all" })
                    }
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Limpiar filtros
                  </Button>
                )}
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
                        {paginatedOrders.map((order) => (
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
                  
                  {/* Paginación */}
                  {!isLoading && filteredOrders.length > 0 && (
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      startIndex={startIndex}
                      endIndex={endIndex}
                      onPageChange={goToPage}
                      itemsPerPage={itemsPerPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
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
