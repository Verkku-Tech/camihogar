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
import { EditOrderDialog } from "@/components/orders/edit-order-dialog"
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
import { OrderPdfRowAction } from "@/components/orders/order-pdf-row-action"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  deleteOrder,
  deleteBudget,
  getUnifiedOrders,
  getClients,
  type UnifiedOrder,
  type Client,
} from "@/lib/storage"
import { buildClientFilterHaystack, digitsOnly } from "@/lib/order-client-search"
import {
  formatCurrencyWithUsdPrimaryFromOrder,
  getActiveExchangeRates,
} from "@/lib/currency-utils"
import { useAuth } from "@/contexts/auth-context"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"
import { ORDER_STATUSES, PURCHASE_TYPES } from "@/components/orders/constants"
import {
  isSistemaApartado,
  isSaWarehouseHighlight,
  purchaseTypeLabel,
} from "@/lib/order-sa"

/** yyyy-MM-dd en calendario local (alineado con toLocaleDateString de la tabla). */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Validado":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
    case "Por Fabricar":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "En Fabricación":
    case "Fabricación":
    case "Fabricándose":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Almacén":
    case "En Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Despacho":
    case "Por despachar":
    case "En Ruta":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Entregado":
    case "Completada":
    case "Completado":
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
  const { user, hasPermission } = useAuth()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [filters, setFilters] = useState({
    vendor: "all",
    status: "all",
    saleType: "all",
  })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<UnifiedOrder | null>(null)
  const [editMode, setEditMode] = useState<"full" | "payments">("full")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderToDelete, setOrderToDelete] = useState<UnifiedOrder | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [clientById, setClientById] = useState<Map<string, Client>>(new Map())

  useEffect(() => {
    const loadClients = async () => {
      try {
        const list = await getClients()
        const map = new Map<string, Client>()
        for (const c of list) {
          map.set(c.id, c)
        }
        setClientById(map)
      } catch (e) {
        console.error("Error cargando clientes para filtro:", e)
      }
    }
    void loadClients()
  }, [])

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

  // Totales: USD (y Bs) con tasa del día del pedido; fallback a tasa activa solo si no hay tasa guardada
  useEffect(() => {
    const updateTotals = async () => {
      if (orders.length === 0) {
        setOrderTotals({})
        return
      }
      const totals: Record<string, string> = {}
      const fallbackRates = await getActiveExchangeRates()
      for (const order of orders) {
        const formatted = await formatCurrencyWithUsdPrimaryFromOrder(
          order.total,
          order,
          fallbackRates,
        )
        totals[order.id] = formatted
      }
      setOrderTotals(totals)
    }
    void updateTotals()
  }, [orders])

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

  const uniqueStatuses = ORDER_STATUSES.map((s) => s.value)

  let rangeFrom = dateFrom
  let rangeTo = dateTo
  if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
    ;[rangeFrom, rangeTo] = [rangeTo, rangeFrom]
  }

  const filteredOrders = orders.filter((order) => {
    // Filtro de búsqueda general (existente)
    const on = (order.orderNumber ?? "").toLowerCase()
    const matchesSearch =
      on.includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtros por columna
    const matchesVendor = filters.vendor === "all" || order.vendorName === filters.vendor
    const matchesStatus = filters.status === "all" || order.status === filters.status
    // Presupuestos unificados suelen no tener saleType; no coinciden con un tipo concreto.
    const matchesSaleType =
      filters.saleType === "all" ||
      (order.saleType !== undefined && order.saleType === filters.saleType)

    const orderDay = toLocalDateKey(order.createdAt)
    const matchesDateFrom = !rangeFrom || orderDay >= rangeFrom
    const matchesDateTo = !rangeTo || orderDay <= rangeTo

    const q = clientSearch.trim().toLowerCase()
    const haystack = buildClientFilterHaystack(
      order.clientName,
      clientById.get(order.clientId),
    ).toLowerCase()
    const matchesClient =
      q === "" ||
      haystack.includes(q) ||
      (digitsOnly(clientSearch) !== "" &&
        digitsOnly(haystack).includes(digitsOnly(clientSearch)))

    const isConvertedBudget =
      order.type === "budget" && order.status.trim().toLowerCase() === "convertido"

    return (
      matchesSearch &&
      matchesVendor &&
      matchesStatus &&
      matchesSaleType &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesClient &&
      !isConvertedBudget
    )
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
    if (!canDeleteOrder(orderToDelete)) {
      toast.error("No tienes permiso para eliminar este registro.")
      setIsDeleteDialogOpen(false)
      setOrderToDelete(null)
      return
    }

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

  const canEditOrderFull = hasPermission("orders.update")
  const canConvertBudget = hasPermission("budgets.convert_to_order")
  const canEditOrderPaymentsOnly = hasPermission("orders.payments.manage")

  const handleEdit = (order: UnifiedOrder) => {
    if (order.type === "budget" && (canConvertBudget || canEditOrderFull)) {
      setOrderToEdit(order)
      setEditMode("full")
      setIsEditOrderOpen(true)
      return
    }
    if (order.type === "order" && canEditOrderFull) {
      setOrderToEdit(order)
      setEditMode("full")
      setIsEditOrderOpen(true)
      return
    }
    if (canEditOrderPaymentsOnly && order.type === "order") {
      setOrderToEdit(order)
      setEditMode("payments")
      setIsEditOrderOpen(true)
      return
    }
    toast.error("Acceso denegado", {
      description: "No tienes permisos para editar este pedido o presupuesto.",
    })
  }

  const canEditOrder = (order: UnifiedOrder) =>
    (order.type === "budget" && (canConvertBudget || canEditOrderFull)) ||
    (order.type === "order" && canEditOrderFull) ||
    (canEditOrderPaymentsOnly && order.type === "order")

  const canDeleteOrder = (order: UnifiedOrder) =>
    order.type === "order"
      ? hasPermission("orders.delete")
      : hasPermission("budgets.delete")

  const handleDeleteClick = (order: UnifiedOrder) => {
    if (!canDeleteOrder(order)) {
      toast.error("No tienes permiso para eliminar este registro.")
      return
    }
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
                <div className="relative w-[200px] min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                  <Input
                    placeholder="Cliente: nombre, teléfono, CI, apodo..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                    aria-label="Filtrar por cliente: nombre, teléfono, CI o apodo"
                  />
                </div>

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
                  value={filters.saleType}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, saleType: value }))
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {PURCHASE_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>
                        {pt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Desde</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[150px]"
                    aria-label="Fecha desde"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Hasta</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[150px]"
                    aria-label="Fecha hasta"
                  />
                </div>

                {(clientSearch !== "" ||
                  filters.vendor !== "all" ||
                  filters.status !== "all" ||
                  filters.saleType !== "all" ||
                  dateFrom !== "" ||
                  dateTo !== "") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilters({ vendor: "all", status: "all", saleType: "all" })
                      setClientSearch("")
                      setDateFrom("")
                      setDateTo("")
                    }}
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
                          <TableHead>Tipo</TableHead>
                          <TableHead>Método de Pago</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className={
                              isSaWarehouseHighlight(order)
                                ? "bg-amber-50/70 dark:bg-amber-950/25 border-l-4 border-l-amber-500/80"
                                : undefined
                            }
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{order.orderNumber}</span>
                                {isSistemaApartado(order) && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50"
                                    title="Sistema de Apartado"
                                  >
                                    SA
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell>{order.vendorName}</TableCell>
                            <TableCell>
                              {orderTotals[order.id] || `Bs.${order.total.toFixed(2)}`}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px]">
                              {purchaseTypeLabel(order.saleType) ?? "—"}
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
                                <OrderPdfRowAction
                                  orderId={order.id}
                                  orderType={order.type}
                                  status={order.status}
                                />
                                {canEditOrder(order) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(order)}
                                    title={
                                      order.type === "budget"
                                        ? "Editar presupuesto"
                                        : canEditOrderFull
                                          ? "Editar pedido"
                                          : "Editar pagos"
                                    }
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {canDeleteOrder(order) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(order)}
                                    title={
                                      order.type === "order"
                                        ? "Eliminar pedido"
                                        : "Eliminar presupuesto"
                                    }
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
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

      <EditOrderDialog
        open={isEditOrderOpen}
        onOpenChange={(open) => {
          setIsEditOrderOpen(open)
          if (!open) {
            setOrderToEdit(null)
            setEditMode("full")
            handleOrderCreated()
          }
        }}
        order={orderToEdit as any}
        mode={editMode}
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
