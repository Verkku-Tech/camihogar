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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { formatCurrency } from "@/lib/currency-utils"
import { OrderGroupCollapsible } from "@/components/orders/order-group-collapsible"
import { toast } from "sonner"
import { getUnifiedOrders, getCategories, updateOrder, type UnifiedOrder, type OrderProduct, type Category, type AttributeValue } from "@/lib/storage"
import { useCurrency } from "@/contexts/currency-context"
import { useRouter } from "next/navigation"
import { DELIVERY_TYPES, DELIVERY_ZONES } from "@/components/orders/new-order-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"

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
// Función helper para verificar si un producto está listo para despacho
const isProductReadyForDispatch = (product: OrderProduct): boolean => {
  if (product.locationStatus === "DESPACHADO") return false // Ya está despachado

  // Si no tiene locationStatus, considerarlo listo (legacy/simple products)
  if (!product.locationStatus) return true

  // Si está en tienda, está listo
  if (product.locationStatus === "EN TIENDA") return true

  // Si debe fabricarse, debe estar En almacén (listo para despacho)
  if (product.locationStatus === "FABRICACION") {
    return product.manufacturingStatus === "almacen_no_fabricado"
  }

  return true
}

// Función helper para verificar si un pedido está listo para despachar (al menos un producto)
const isOrderReadyForDispatch = (order: UnifiedOrder): boolean => {
  // Solo pedidos tipo "order" (no presupuestos)
  if (order.type !== "order") return false

  // Si ya está completado, incluirlo en las notas de despacho
  if (order.status === "Completada") {
    return true
  }

  // Verificar que tenga productos
  if (!order.products || order.products.length === 0) return false

  // El pedido aparece si tiene AL MENOS UN producto listo para despacho (y no despachado aún)
  // O si todos los productos ya están despachados (para que aparezca como completado eventualmente)
  return order.products.some(p => isProductReadyForDispatch(p) || p.locationStatus === "DESPACHADO")
}

// Calcular saldo pendiente en Bs y equivalente en USD
function getPendingBalance(order: UnifiedOrder) {
  const totalPaid = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0
  return Math.max(0, order.total - totalPaid)
}

function formatPendingInUsd(pendingBs: number, usdRate: number | undefined): string {
  if (!usdRate || usdRate <= 0) return formatCurrency(pendingBs, "Bs")
  return formatCurrency(pendingBs / usdRate, "USD")
}

export default function DespachosPage() {
  const { formatWithPreference, preferredCurrency, exchangeRates } = useCurrency()
  const router = useRouter()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>("all")
  const [deliveryZoneFilter, setDeliveryZoneFilter] = useState<string>("all")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})
  const usdRate = exchangeRates?.USD?.rate
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [orderToComplete, setOrderToComplete] = useState<UnifiedOrder | null>(null)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const [isBulkDispatchDialogOpen, setIsBulkDispatchDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [categories, setCategories] = useState<Category[]>([])

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

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

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const loaded = await getCategories()
        setCategories(loaded)
      } catch (error) {
        console.error("Error loading categories:", error)
      }
    }
    loadCategories()
  }, [])

  const getCategoryForProduct = (productCategory: string) =>
    categories.find(c => c.name === productCategory)

  const getValueLabel = (value: string | AttributeValue): string => {
    if (typeof value === "string") return value
    return (value as AttributeValue).label || (value as AttributeValue).id || String(value)
  }

  const getAttributeValueLabel = (
    selectedValue: unknown,
    categoryAttribute: Category["attributes"][0] | undefined
  ): string => {
    if (!categoryAttribute) return String(selectedValue)
    if (categoryAttribute.valueType === "Number") {
      return selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
        ? String(selectedValue)
        : ""
    }
    if (!categoryAttribute.values || categoryAttribute.values.length === 0) {
      return String(selectedValue)
    }
    if (Array.isArray(selectedValue)) {
      const labels: string[] = []
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values!.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") return val === valStr
            return (val as AttributeValue).id === valStr || (val as AttributeValue).label === valStr
          }
        )
        if (attributeValue) {
          labels.push(getValueLabel(attributeValue as string | AttributeValue))
        } else {
          labels.push(String(valStr))
        }
      })
      return labels.join(", ")
    }
    const selectedValueStr = String(selectedValue ?? "")
    if (selectedValueStr) {
      const attributeValue = categoryAttribute.values.find(
        (val: string | AttributeValue) => {
          if (typeof val === "string") return val === selectedValueStr
          return (val as AttributeValue).id === selectedValueStr || (val as AttributeValue).label === selectedValueStr
        }
      )
      if (attributeValue) return getValueLabel(attributeValue as string | AttributeValue)
    }
    return String(selectedValue)
  }

  const getProductAttributePairs = (product: OrderProduct): { key: string; value: string }[] => {
    const category = getCategoryForProduct(product.category)
    if (!product.attributes || Object.keys(product.attributes).length === 0) return []
    const pairs: { key: string; value: string }[] = []
    for (const [key, value] of Object.entries(product.attributes)) {
      if (key.includes("_") && key.split("_").length === 2) continue
      const categoryAttribute = category?.attributes?.find(
        attr => attr.id?.toString() === key || attr.title === key
      )
      const valueLabel = getAttributeValueLabel(value, categoryAttribute)
      if (valueLabel && valueLabel.trim() !== "") {
        pairs.push({
          key: categoryAttribute?.title || key,
          value: valueLabel.trim()
        })
      }
    }
    return pairs
  }

  const AttributesGrid = ({ pairs, productName }: { pairs: { key: string; value: string }[]; productName?: string }) => {
    if (pairs.length === 0) return <p className="text-sm text-muted-foreground">Sin atributos</p>
    return (
      <div className="space-y-2">
        {productName && <h4 className="font-semibold text-sm">{productName}</h4>}
        <div className="grid grid-cols-5 gap-x-4 gap-y-2 text-sm">
          {pairs.map(({ key, value }) => (
            <div key={key} className="flex flex-col min-w-0">
              <span className="text-muted-foreground font-medium">{key}:</span>
              <span className="text-foreground break-words">{value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

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

  const filteredOrders = orders.filter((order) => {
    // Filtro de búsqueda
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendorName.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por tipo de entrega
    const matchesDeliveryType =
      deliveryTypeFilter === "all" ||
      order.deliveryType === deliveryTypeFilter

    // Filtro por zona de entrega
    const matchesDeliveryZone =
      deliveryZoneFilter === "all" ||
      order.deliveryZone === deliveryZoneFilter

    return matchesSearch && matchesDeliveryType && matchesDeliveryZone
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

  // Manejar selección individual (select all ready products of the order)
  const handleToggleSelect = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    const readyProducts = order.products.filter(p => isProductReadyForDispatch(p) && p.locationStatus !== "DESPACHADO")
    const readyProductKeys = readyProducts.map(p => `${order.id}|${p.id}`)

    // Check if all ready products are currently selected
    const allReadySelected = readyProductKeys.length > 0 && readyProductKeys.every(key => selectedOrders.has(key))

    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (allReadySelected) {
        // Deselect all
        readyProductKeys.forEach(key => next.delete(key))
      } else {
        // Select all
        readyProductKeys.forEach(key => next.add(key))
      }
      return next
    })
  }

  // Manejar selección de todos (solo los que no están completados)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = new Set<string>()
      paginatedOrders.forEach(order => {
        if (order.status !== "Completada") {
          order.products.forEach(p => {
            if (isProductReadyForDispatch(p) && p.locationStatus !== "DESPACHADO") {
              allKeys.add(`${order.id}|${p.id}`)
            }
          })
        }
      })
      setSelectedOrders(allKeys)
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleView = (order: UnifiedOrder) => {
    router.push(`/pedidos/${order.orderNumber}`)
  }

  // Despachar un pedido individual (respetando selección o todos los listos)
  const handleCompleteDispatch = async () => {
    if (!orderToComplete) return

    try {
      // 1. Identificar productos a despachar
      // Buscar si hay productos seleccionados para este pedido
      const selectedProductIds = Array.from(selectedOrders)
        .filter(key => key.startsWith(`${orderToComplete.id}|`))
        .map(key => key.split("|")[1])

      let productsToDispatch: OrderProduct[] = []

      if (selectedProductIds.length > 0) {
        // Opción A: Despachar SOLO los seleccionados
        productsToDispatch = orderToComplete.products.filter(p => selectedProductIds.includes(p.id))
      } else {
        // Opción B: Si no hay nada seleccionado, despachar TODOS los que estén LISTOS
        productsToDispatch = orderToComplete.products.filter(p => isProductReadyForDispatch(p) && p.locationStatus !== "DESPACHADO")
      }

      if (productsToDispatch.length === 0) {
        toast.warning("No hay productos listos para despachar en este pedido.")
        setIsCompleteDialogOpen(false)
        return
      }

      // 2. Actualizar estado de los productos (solo los identificados)
      const dispatchingIds = new Set(productsToDispatch.map(p => p.id))

      const updatedProducts = orderToComplete.products.map(p => {
        if (dispatchingIds.has(p.id)) {
          return { ...p, locationStatus: "DESPACHADO" as const }
        }
        return p
      })

      // 3. Verificar si el pedido se completa totalmente
      // Un pedido está completo si TODOS sus productos tienen status DESPACHADO (o legacy finished)
      const allDispatched = updatedProducts.every(p =>
        p.locationStatus === "DESPACHADO"
      )

      await updateOrder(orderToComplete.id, {
        products: updatedProducts,
        status: allDispatched ? "Completada" : (orderToComplete.status as any),
        dispatchDate: allDispatched ? new Date().toISOString() : orderToComplete.dispatchDate,
        completedAt: allDispatched ? new Date().toISOString() : orderToComplete.completedAt,
      })

      // Refrescar la lista
      const allOrders = await getUnifiedOrders()
      const readyOrders = allOrders.filter((order) => isOrderReadyForDispatch(order))
      setOrders(readyOrders)
      setIsCompleteDialogOpen(false)
      setOrderToComplete(null)

      // Limpiar selección de este pedido
      setSelectedOrders((prev) => {
        const newSet = new Set(prev)
        Array.from(newSet).forEach(key => {
          if (key.startsWith(`${orderToComplete.id}|`)) newSet.delete(key)
        })
        return newSet
      })

      const msg = allDispatched
        ? "Pedido completado exitosamente"
        : `Despachados ${productsToDispatch.length} producto(s)`
      toast.success(msg)
    } catch (error) {
      console.error("Error completing dispatch:", error)
      toast.error("Error al completar el despacho. Por favor intenta nuevamente.")
    }
  }



  // Manejar despacho de productos seleccionados (parcial o total)
  const handleDispatchSelectedProducts = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Por favor selecciona al menos un producto para despachar")
      return
    }

    try {
      setIsLoading(true)
      const selectedItems = Array.from(selectedOrders)
      const ordersToUpdate = new Set<string>()

      // Agrupar productos por pedido
      const productsByOrder: Record<string, string[]> = {}
      selectedItems.forEach(item => {
        // Formato esperado: "orderId|productId"
        // Si no tiene pipe, es un orderId completo (selección antigua) -> convertir a todos los productos listos
        if (!item.includes("|")) {
          const order = orders.find(o => o.id === item)
          if (order) {
            if (!productsByOrder[item]) productsByOrder[item] = []
            order.products.forEach(p => {
              if (isProductReadyForDispatch(p)) {
                productsByOrder[item].push(p.id)
              }
            })
            ordersToUpdate.add(item)
          }
          return
        }

        const [orderId, productId] = item.split("|")
        if (!productsByOrder[orderId]) productsByOrder[orderId] = []
        productsByOrder[orderId].push(productId)
        ordersToUpdate.add(orderId)
      })

      let successCount = 0
      let errorCount = 0

      for (const orderId of ordersToUpdate) {
        try {
          const order = orders.find(o => o.id === orderId)
          if (!order) continue

          const productsToDispatch = productsByOrder[orderId]
          if (!productsToDispatch || productsToDispatch.length === 0) continue

          // Actualizar estado de los productos seleccionados
          const updatedProducts = order.products.map(p => {
            if (productsToDispatch.includes(p.id)) {
              return { ...p, locationStatus: "DESPACHADO" as const }
            }
            return p
          })

          // Verificar si TODOS los productos están ahora despachados
          const allDispatched = updatedProducts.every(p =>
            p.locationStatus === "DESPACHADO"
          )

          await updateOrder(orderId, {
            products: updatedProducts,
            status: allDispatched ? "Completada" : (order.status as any),
            dispatchDate: allDispatched ? new Date().toISOString() : order.dispatchDate,
            completedAt: allDispatched ? new Date().toISOString() : order.completedAt,
          })

          successCount += productsToDispatch.length
        } catch (error) {
          console.error(`Error actualizando pedido ${orderId}:`, error)
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
        toast.success(`${successCount} producto(s) despachado(s) exitosamente`)
      } else {
        toast.warning(`${successCount} producto(s) despachado(s), ${errorCount} error(es)`)
      }
    } catch (error) {
      console.error("Error en despacho:", error)
      toast.error("Error al procesar el despacho")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper para alternar selección de producto
  const handleToggleProduct = (orderId: string, productId: string) => {
    const key = `${orderId}|${productId}`
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCompleteClick = (order: UnifiedOrder) => {
    setOrderToComplete(order)
    setIsCompleteDialogOpen(true)
  }

  // Solo contar pedidos que no están completados para la selección
  const selectableOrders = paginatedOrders.filter(order => order.status !== "Completada")
  const allSelected = selectableOrders.length > 0 && selectedOrders.size === selectableOrders.length
  const someSelected = selectedOrders.size > 0 && selectedOrders.size < selectableOrders.length

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
              <div className="flex flex-col gap-4">
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
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="space-y-2 flex-1 max-w-xs">
                    <Label htmlFor="deliveryTypeFilter">Tipo de Entrega</Label>
                    <Select
                      value={deliveryTypeFilter}
                      onValueChange={setDeliveryTypeFilter}
                    >
                      <SelectTrigger id="deliveryTypeFilter">
                        <SelectValue placeholder="Todos los tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {DELIVERY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex-1 max-w-xs">
                    <Label htmlFor="deliveryZoneFilter">Zona de Entrega</Label>
                    <Select
                      value={deliveryZoneFilter}
                      onValueChange={setDeliveryZoneFilter}
                    >
                      <SelectTrigger id="deliveryZoneFilter">
                        <SelectValue placeholder="Todas las zonas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las zonas</SelectItem>
                        {DELIVERY_ZONES.map((zone) => (
                          <SelectItem key={zone.value} value={zone.value}>
                            {zone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Pedidos para Despachar
                  </CardTitle>
                  <CardDescription>
                    Lista de pedidos listos para ser despachados y pedidos ya completados. Selecciona uno o varios para despachar.
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
                    <div className="space-y-2">
                      {/* Cabecera de tabla: checkbox "seleccionar todos" solo visible si hay pedidos despachables */}
                      {filteredOrders.some((order) => order.status !== "Completada") && (
                        <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground border-b pb-2 mb-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Seleccionar todos"
                          />
                          <span>Seleccionar todos los pedidos para despacho masivo</span>
                        </div>
                      )}
                      {paginatedOrders.map((order) => {
                        // Calculate if order is selected (all ready products are selected)
                        const readyProducts = order.products.filter(p => isProductReadyForDispatch(p) && p.locationStatus !== "DESPACHADO")
                        const readyProductKeys = readyProducts.map(p => `${order.id}|${p.id}`)
                        const isSelected = readyProducts.length > 0 && readyProductKeys.every(key => selectedOrders.has(key))
                        // Partially selected: some but not all
                        const isPartiallySelected = readyProducts.length > 0 && readyProductKeys.some(key => selectedOrders.has(key)) && !isSelected

                        return (
                          <OrderGroupCollapsible
                            key={order.id}
                            orderId={order.id}
                            orderNumber={order.orderNumber}
                            clientName={order.clientName}
                            orderDate={order.createdAt}
                            productCount={order.products.length}
                            isExpanded={expandedOrders.has(order.id)}
                            onOpenChange={(open) =>
                              open ? setExpandedOrders((s) => new Set(s).add(order.id)) : setExpandedOrders((s) => { const n = new Set(s); n.delete(order.id); return n })
                            }
                            showViewDetailsButton={false}
                            selectControl={
                              order.status !== "Completada"
                                ? {
                                  checked: isSelected ? true : isPartiallySelected ? "indeterminate" : false,
                                  onCheckedChange: () => handleToggleSelect(order.id),
                                  "aria-label": `Seleccionar productos listos del pedido ${order.orderNumber}`,
                                  disabled: readyProducts.length === 0
                                }
                                : undefined
                            }
                            headerRight={
                              <>
                                <span className="text-sm text-muted-foreground hidden sm:inline">
                                  {order.vendorName}
                                </span>
                                <span className="font-medium tabular-nums">
                                  {orderTotals[order.id] ?? `Bs.${order.total.toFixed(2)}`}
                                </span>
                                <Badge className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleView(order)
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Ver Detalles
                                </Button>
                                {order.status !== "Completada" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCompleteClick(order)
                                    }}
                                    title="Despachar productos seleccionados o listos"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Despachar
                                  </Button>
                                )}
                              </>
                            }
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]"></TableHead>
                                  <TableHead>Producto</TableHead>
                                  <TableHead>Categoría</TableHead>
                                  <TableHead>Cantidad</TableHead>
                                  <TableHead>Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.products.map((product) => {
                                  const isReady = isProductReadyForDispatch(product)
                                  const isDispatched = product.locationStatus === "DESPACHADO"
                                  const isProductSelected = selectedOrders.has(`${order.id}|${product.id}`)

                                  return (
                                    <HoverCard key={product.id} openDelay={200} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <TableRow
                                          className={`hover:bg-muted/50 cursor-pointer ${isDispatched ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}
                                          onClick={(e) => {
                                            if (isReady && !isDispatched) {
                                              handleToggleProduct(order.id, product.id)
                                            }
                                          }}
                                        >
                                          <TableCell className="w-[50px]">
                                            <Checkbox
                                              checked={isProductSelected || isDispatched}
                                              disabled={!isReady || isDispatched}
                                              onCheckedChange={() => handleToggleProduct(order.id, product.id)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                              <span>{product.name}</span>
                                              {isDispatched && (
                                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                  <CheckCircle className="w-3 h-3" /> Despachado
                                                </span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline">{product.category}</Badge>
                                          </TableCell>
                                          <TableCell>{product.quantity}</TableCell>
                                          <TableCell>
                                            {(product.manufacturingStatus === "almacen_no_fabricado" ||
                                              (product.manufacturingStatus as string) === "fabricado") ? (
                                              <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                                En almacén
                                              </Badge>
                                            ) : product.manufacturingStatus === "fabricando" ? (
                                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                                Fabricando
                                              </Badge>
                                            ) : product.locationStatus === "EN TIENDA" ? (
                                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                En Tienda
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-muted text-muted-foreground">-</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="min-w-[480px] max-w-[min(640px,95vw)] w-max" align="start">
                                        <AttributesGrid
                                          pairs={getProductAttributePairs(product)}
                                          productName={product.name}
                                        />
                                      </HoverCardContent>
                                    </HoverCard>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </OrderGroupCollapsible>
                        )
                      })}
                    </div>
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

      {/* Dialog de confirmación de completado individual */}
      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Despachar productos?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas despachar los productos seleccionados o listos del pedido "{orderToComplete?.orderNumber}"?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Cliente: {orderToComplete?.clientName} - Total: {orderToComplete ? (orderTotals[orderToComplete.id] || `Bs.${orderToComplete.total.toFixed(2)}`) : ""}
              </span>
              <br />
              <span className="text-sm font-medium text-green-600 mt-2 block">
                Los productos se marcarán como "Despachado". Si todos se completan, el pedido pasará a "Completada".
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
              Despachar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmación de despacho de productos seleccionados */}
      <AlertDialog open={isBulkDispatchDialogOpen} onOpenChange={setIsBulkDispatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Despachar {selectedOrders.size} producto(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas marcar {selectedOrders.size} producto(s) como despachados?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Los productos seleccionados se marcarán como "Despachado". Si todos los productos de un pedido se despachan, el pedido cambiará a estado "Completada".
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBulkDispatchDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispatchSelectedProducts}
              className="bg-green-600 hover:bg-green-700"
            >
              Despachar Productos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}

