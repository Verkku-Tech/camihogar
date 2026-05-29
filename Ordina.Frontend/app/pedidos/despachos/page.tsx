"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { Search, Eye, Truck, CheckCircle, PackageCheck, RotateCcw, Download } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { OrderGroupCollapsible } from "@/components/orders/order-group-collapsible"
import { toast } from "sonner"
import { getUnifiedOrders, getCategories, updateOrder, type UnifiedOrder, type OrderProduct, type Category, type AttributeValue } from "@/lib/storage"
import { isSistemaApartado } from "@/lib/order-sa"
import { useCurrency } from "@/contexts/currency-context"
import { getActiveExchangeRates } from "@/lib/currency-utils"
import {
  commercialRatesToExchangeRatesInput,
  formatCommercialDualDisplay,
  formatOrderAmountForDisplay,
  getCommercialRatesFromOrder,
} from "@/lib/order-currency-display"
import {
  getLinePriceCurrency,
  type ExchangeRatesInput,
} from "@/lib/order-line-pricing"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { matchesLocalDateRange } from "@/lib/date-utils"

type TabType = "por_despachar" | "en_despacho" | "despachados"
type ActionType = "to_dispatch" | "to_delivered" | "to_store"

type DeliveredRow = { order: UnifiedOrder; product: OrderProduct }

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

// Helper: Determina en qué pestaña cae un producto individual
const getProductDispatchStatus = (product: OrderProduct): TabType | "none" => {
  if (product.locationStatus === "DESPACHADO") return "despachados"
  if (product.locationStatus === "EN DESPACHO") return "en_despacho"

  // Condicionales para "por_despachar" (Listos)
  if (!product.locationStatus) return "por_despachar"
  if (product.locationStatus === "EN TIENDA") return "por_despachar"
  if (product.locationStatus === "DISPONIBILIDAD INMEDIATA") return "por_despachar"
  if (product.locationStatus === "FABRICACION" && product.manufacturingStatus === "almacen_no_fabricado") {
    return "por_despachar"
  }

  return "none"
}

/** Actualiza ubicación/logística y fecha de entrega al confirmar o revertir despacho. */
const applyDispatchProductUpdate = (
  product: OrderProduct,
  action: ActionType
): OrderProduct => {
  if (action === "to_dispatch") {
    return {
      ...product,
      locationStatus: "EN DESPACHO",
      logisticStatus: "En Ruta",
    }
  }
  if (action === "to_delivered") {
    return {
      ...product,
      locationStatus: "DESPACHADO",
      logisticStatus: "Completado",
      deliveredAt: new Date().toISOString(),
    }
  }
  return {
    ...product,
    locationStatus: "EN TIENDA",
    logisticStatus: "En Almacén",
    deliveredAt: undefined,
  }
}

const formatDeliveredAtDisplay = (iso: string | undefined): string => {
  if (!iso?.trim()) return "—"
  try {
    return new Date(iso).toLocaleString("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

const escapeCsvCell = (value: string): string => {
  const s = value ?? ""
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const deliveryZoneLabel = (zone: string | undefined): string => {
  if (!zone) return ""
  const found = DELIVERY_ZONES.find((z) => z.value === zone)
  return found?.label ?? zone
}

// Helper: Verifica si el pedido debe mostrarse en una pestaña específica
const isOrderInTab = (order: UnifiedOrder, tab: TabType): boolean => {
  if (order.type !== "order") return false
  if (order.status === "Generado" || order.status === "Generada") return false

  // Si pedimos ver despachados y la orden está completada entera, la mostramos ahí
  if (tab === "despachados" && order.status === "Completada") return true

  if (!order.products || order.products.length === 0) return false

  // Un pedido aparece en la pestaña si al menos uno de sus productos corresponde a ese estado
  return order.products.some(p => getProductDispatchStatus(p) === tab)
}

type AttributesGridProps = {
  pairs: { key: string; value: string }[]
  productName?: string
}

function AttributesGrid({ pairs, productName }: AttributesGridProps) {
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

export default function DespachosPage() {
  const { user } = useAuth()
  const canMutateDispatchStatus =
    user?.role === "Super Administrator" || user?.role === "Administrator"
  const { exchangeRates } = useCurrency()
  const router = useRouter()
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>("all")
  const [deliveryZoneFilter, setDeliveryZoneFilter] = useState<string>("all")
  const [deliveredDateFrom, setDeliveredDateFrom] = useState("")
  const [deliveredDateTo, setDeliveredDateTo] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("por_despachar")

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({})
  const usdRate = exchangeRates?.USD?.rate
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  
  const [orderToActOn, setOrderToActOn] = useState<UnifiedOrder | null>(null)
  const [actionType, setActionType] = useState<ActionType | null>(null)
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false)
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [categories, setCategories] = useState<Category[]>([])
  /** Totales de línea formateados (pestaña despachados, filas paginadas). */
  const [lineTotalLabels, setLineTotalLabels] = useState<Record<string, string>>({})

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      const allOrders = await getUnifiedOrders()
      // Guardar todos los pedidos que calcen en AL Menos UNA de las pestañas posibles
      const dispatchableOrders = allOrders.filter(
        (order) => order.type === "order" && (
          isOrderInTab(order, "por_despachar") || 
          isOrderInTab(order, "en_despacho") || 
          isOrderInTab(order, "despachados")
        )
      )
      setOrders(dispatchableOrders)
    } catch (error) {
      console.error("Error loading dispatch orders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
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

  // Limpiar selecciones y filtro de fecha al cambiar de pestaña
  useEffect(() => {
    setSelectedOrders(new Set())
    setExpandedOrders(new Set())
    if (activeTab !== "despachados") {
      setDeliveredDateFrom("")
      setDeliveredDateTo("")
    }
  }, [activeTab])

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

  useEffect(() => {
    const updateTotals = async () => {
      const rates = await getActiveExchangeRates()
      const live = commercialRatesToExchangeRatesInput({
        USD: rates.USD,
        EUR: rates.EUR,
      })
      const totals: Record<string, string> = {}
      for (const order of orders) {
        totals[order.id] = formatOrderAmountForDisplay(order.total, order, live)
      }
      setOrderTotals(totals)
    }
    if (orders.length > 0) {
      void updateTotals()
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Filtrar por tab activo
      if (!isOrderInTab(order, activeTab)) return false

      // 2. Filtro de búsqueda
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendorName.toLowerCase().includes(searchTerm.toLowerCase())

      // 3. Filtro por tipo de entrega
      const matchesDeliveryType =
        deliveryTypeFilter === "all" ||
        order.deliveryType === deliveryTypeFilter

      // 4. Filtro por zona de entrega
      const matchesDeliveryZone =
        deliveryZoneFilter === "all" ||
        order.deliveryZone === deliveryZoneFilter

      return matchesSearch && matchesDeliveryType && matchesDeliveryZone
    })
  }, [
    orders,
    activeTab,
    searchTerm,
    deliveryTypeFilter,
    deliveryZoneFilter,
  ])

  const hasDeliveredDateFilter =
    deliveredDateFrom !== "" || deliveredDateTo !== ""

  const deliveredRows = useMemo((): DeliveredRow[] => {
    const rows: DeliveredRow[] = []
    for (const order of filteredOrders) {
      if (order.type !== "order") continue
      for (const product of order.products) {
        if (getProductDispatchStatus(product) !== "despachados") continue
        if (
          !matchesLocalDateRange(
            product.deliveredAt,
            deliveredDateFrom,
            deliveredDateTo,
          )
        ) {
          continue
        }
        rows.push({ order, product })
      }
    }
    return rows
  }, [filteredOrders, deliveredDateFrom, deliveredDateTo])

  const handleExportDispatchedCsv = useCallback(async () => {
    const headers = [
      "Pedido",
      "Cliente",
      "Vendedor",
      "Producto",
      "Cantidad",
      "Precio de venta",
      "Zona entrega",
      "Fecha entrega",
    ]
    const rows: string[][] = []
    try {
      for (const { order, product } of deliveredRows) {
        const commercial = commercialRatesToExchangeRatesInput(
          getCommercialRatesFromOrder(order),
        )
        const live: ExchangeRatesInput = {
          USD: exchangeRates?.USD,
          EUR: exchangeRates?.EUR,
        }
        const precioVenta = formatCommercialDualDisplay(
          product.total,
          getLinePriceCurrency(product),
          { commercialRates: commercial, liveRates: live },
        )
        rows.push([
          order.orderNumber,
          order.clientName,
          order.vendorName ?? "",
          product.name,
          String(product.quantity),
          precioVenta,
          deliveryZoneLabel(order.deliveryZone),
          product.deliveredAt
            ? new Date(product.deliveredAt).toLocaleString("es-VE", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "",
        ])
      }
      const lines = [headers.map(escapeCsvCell).join(",")]
      for (const r of rows) {
        lines.push(r.map(escapeCsvCell).join(","))
      }
      const csv = "\uFEFF" + lines.join("\r\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `historial-despachados-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Listado exportado (CSV)")
    } catch (error) {
      console.error("Error exportando CSV de despachados:", error)
      toast.error("No se pudo generar el CSV")
    }
  }, [deliveredRows, exchangeRates])

  // Paginación: por pedido (almacén / en ruta) o por fila entregada (despachados)
  const ordersPagination = usePagination({
    data: filteredOrders,
    itemsPerPage,
  })
  const deliveredRowsPagination = usePagination({
    data: deliveredRows,
    itemsPerPage,
  })

  const paginatedOrders = ordersPagination.paginatedData
  const paginatedDeliveredRows = deliveredRowsPagination.paginatedData
  const deliveredCurrentPage = deliveredRowsPagination.currentPage

  const deliveredPageLineTotalsSignature = useMemo(() => {
    if (activeTab !== "despachados") return ""
    const start = (deliveredCurrentPage - 1) * itemsPerPage
    const pageRows = deliveredRows.slice(start, start + itemsPerPage)
    if (pageRows.length === 0) return ""
    return pageRows
      .map(({ order, product }) => `${order.id}|${product.id}|${product.total}`)
      .join("|")
  }, [activeTab, deliveredRows, deliveredCurrentPage, itemsPerPage])

  const listPagination =
    activeTab === "despachados" ? deliveredRowsPagination : ordersPagination
  const {
    currentPage,
    totalPages,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = listPagination

  useEffect(() => {
    if (activeTab !== "despachados" || deliveredPageLineTotalsSignature === "") {
      return
    }
    const start = (deliveredCurrentPage - 1) * itemsPerPage
    const pageRows = deliveredRows.slice(start, start + itemsPerPage)
    if (pageRows.length === 0) return

    let cancelled = false
    const run = () => {
      const live: ExchangeRatesInput = {
        USD: exchangeRates?.USD,
        EUR: exchangeRates?.EUR,
      }
      const next: Record<string, string> = {}
      for (const { order, product } of pageRows) {
        const k = `${order.id}|${product.id}`
        const commercial = commercialRatesToExchangeRatesInput(
          getCommercialRatesFromOrder(order),
        )
        next[k] = formatCommercialDualDisplay(
          product.total,
          getLinePriceCurrency(product),
          { commercialRates: commercial, liveRates: live },
        )
      }
      if (!cancelled) {
        setLineTotalLabels((prev) => ({ ...prev, ...next }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, deliveredPageLineTotalsSignature, exchangeRates])

  // Manejar selección individual de productos relevantes a la pestaña
  const handleToggleSelect = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    const activeProducts = order.products.filter(p => getProductDispatchStatus(p) === activeTab)
    const activeProductKeys = activeProducts.map(p => `${order.id}|${p.id}`)

    const allActiveSelected = activeProductKeys.length > 0 && activeProductKeys.every(key => selectedOrders.has(key))

    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (allActiveSelected) {
        // Deselect all
        activeProductKeys.forEach(key => next.delete(key))
      } else {
        // Select all
        activeProductKeys.forEach(key => next.add(key))
      }
      return next
    })
  }

  // Manejar selección de todos
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = new Set<string>()
      paginatedOrders.forEach(order => {
        order.products.forEach(p => {
          if (getProductDispatchStatus(p) === activeTab) {
            allKeys.add(`${order.id}|${p.id}`)
          }
        })
      })
      setSelectedOrders(allKeys)
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleToggleProduct = (orderId: string, productId: string) => {
    const key = `${orderId}|${productId}`
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleView = (order: UnifiedOrder) => {
    router.push(`/pedidos/${order.orderNumber}`)
  }

  const handleActionClick = (order: UnifiedOrder, action: ActionType) => {
    if (!canMutateDispatchStatus) {
      toast.error("Solo administradores pueden modificar el despacho.")
      return
    }
    setOrderToActOn(order)
    setActionType(action)
    setIsActionDialogOpen(true)
  }

  const handleBulkActionClick = (action: ActionType) => {
    if (!canMutateDispatchStatus) {
      toast.error("Solo administradores pueden modificar el despacho.")
      return
    }
    if (selectedOrders.size === 0) {
      toast.error(`Selecciona al menos un producto para aplicar la acción`)
      return
    }
    setActionType(action)
    setIsBulkActionDialogOpen(true)
  }

  // Ejecuta la acción en BDD de un solo pedido
  const handleExecuteAction = async () => {
    if (!canMutateDispatchStatus) {
      toast.error("Solo administradores pueden modificar el despacho.")
      setIsActionDialogOpen(false)
      return
    }
    if (!orderToActOn || !actionType) return

    try {
      const selectedProductIds = Array.from(selectedOrders)
        .filter(key => key.startsWith(`${orderToActOn.id}|`))
        .map(key => key.split("|")[1])

      let productsToActOn: OrderProduct[] = []

      if (selectedProductIds.length > 0) {
        productsToActOn = orderToActOn.products.filter(p => selectedProductIds.includes(p.id))
      } else {
        // Si no hay seleccionado manual, afectamos todos los de la tab vigente en este pedido
        productsToActOn = orderToActOn.products.filter(p => getProductDispatchStatus(p) === activeTab)
      }

      if (productsToActOn.length === 0) {
        toast.warning("No hay productos válidos para esta acción en el pedido.")
        setIsActionDialogOpen(false)
        return
      }

      const actingIds = new Set(productsToActOn.map(p => p.id))

      const updatedProducts = orderToActOn.products.map(p =>
        actingIds.has(p.id) ? applyDispatchProductUpdate(p, actionType) : p
      )

      // Verificar si el pedido se completa totalmente
      // Un pedido está completo SOLO si TODOS sus productos tienen status DESPACHADO (o legacy finished)
      // Incluso los que no tocamos ahora, deben estar DESPACHADOS para completar.
      let newOrderStatus = orderToActOn.status as any
      let completedAt = orderToActOn.completedAt
      let dispatchDate = orderToActOn.dispatchDate

      // Al Entregar, si todo quedó entregado -> Completada.
      if (actionType === "to_delivered") {
        const allDispatched = updatedProducts.every(p => p.locationStatus === "DESPACHADO")
        if (allDispatched) {
          newOrderStatus = "Completada"
          completedAt = new Date().toISOString()
          dispatchDate = dispatchDate || new Date().toISOString()
        }
      }

      await updateOrder(orderToActOn.id, {
        products: updatedProducts,
        status: newOrderStatus,
        dispatchDate: dispatchDate,
        completedAt: completedAt,
      })

      await loadOrders()
      setIsActionDialogOpen(false)
      setOrderToActOn(null)
      setActionType(null)

      setSelectedOrders((prev) => {
        const newSet = new Set(prev)
        Array.from(newSet).forEach(key => {
          if (key.startsWith(`${orderToActOn.id}|`)) newSet.delete(key)
        })
        return newSet
      })

      toast.success(`Acción realizada sobre ${productsToActOn.length} producto(s)`)
    } catch (error) {
      console.error("Error executing action:", error)
      toast.error("Error al procesar. Por favor intenta nuevamente.")
    }
  }

  const handleExecuteBulkAction = async () => {
    if (!canMutateDispatchStatus) {
      toast.error("Solo administradores pueden modificar el despacho.")
      setIsBulkActionDialogOpen(false)
      return
    }
    if (selectedOrders.size === 0 || !actionType) return

    try {
      setIsLoading(true)
      const selectedItems = Array.from(selectedOrders)
      const productsByOrder: Record<string, string[]> = {}

      selectedItems.forEach(item => {
        // En este nuevo formato todo es orderId|productId
        if (item.includes("|")) {
          const [oId, pId] = item.split("|")
          if (!productsByOrder[oId]) productsByOrder[oId] = []
          productsByOrder[oId].push(pId)
        }
      })

      let updatedCount = 0

      for (const [orderId, pIds] of Object.entries(productsByOrder)) {
        const order = orders.find(o => o.id === orderId)
        if (!order) continue

        const updatedProducts = order.products.map(p =>
          pIds.includes(p.id) ? applyDispatchProductUpdate(p, actionType) : p
        )

        let newOrderStatus = order.status as any
        let completedAt = order.completedAt
        let dispatchDate = order.dispatchDate

        if (actionType === "to_delivered") {
          const allDispatched = updatedProducts.every(p => p.locationStatus === "DESPACHADO")
          if (allDispatched) {
            newOrderStatus = "Completada"
            completedAt = new Date().toISOString()
            dispatchDate = dispatchDate || new Date().toISOString()
          }
        }

        await updateOrder(order.id, {
          products: updatedProducts,
          status: newOrderStatus,
          dispatchDate: dispatchDate,
          completedAt: completedAt,
        })
        updatedCount += pIds.length
      }

      await loadOrders()
      setIsBulkActionDialogOpen(false)
      setSelectedOrders(new Set())
      setActionType(null)
      toast.success(`Acción procesada para ${updatedCount} producto(s).`)
    } catch (error) {
      console.error("Error bulk action:", error)
      toast.error("Error al procesar en lote. Verifica la consola.")
    } finally {
      setIsLoading(false)
    }
  }

  const allSelected = paginatedOrders.length > 0 && paginatedOrders.every(order => {
    const activeProducts = order.products.filter(p => getProductDispatchStatus(p) === activeTab)
    if (activeProducts.length === 0) return true
    return activeProducts.every(p => selectedOrders.has(`${order.id}|${p.id}`))
  })

  // Textos e íconos dinámicos
  const getModalTitle = () => {
    if (actionType === "to_dispatch") return "¿Pasar a En Despacho?"
    if (actionType === "to_delivered") return "¿Confirmar Entrega/Despachado?"
    if (actionType === "to_store") return "¿Devolver a Almacén?"
    return ""
  }

  const getModalDescription = () => {
    if (actionType === "to_dispatch") return "Los productos se enviarán a ruta. El pedido no se cerrará todavía."
    if (actionType === "to_delivered") return "Los productos se marcarán como Entregados (Despachados). Si el pedido queda entregado en su totalidad, pasará al estado Completada."
    if (actionType === "to_store") return "Los productos volverán a estar 'En Tienda' listos para futuro despacho."
    return ""
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto p-4 lg:p-6 space-y-6">

              {/* TABS DE SECCIÓN */}
              <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabType)} className="w-full">
                <TabsList className="flex h-auto w-full justify-start overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-3 max-w-xl mx-auto mb-6">
                  <TabsTrigger value="por_despachar" className="text-sm font-medium">En Almacen</TabsTrigger>
                  <TabsTrigger value="en_despacho" className="text-sm font-medium">En Despacho (En Ruta)</TabsTrigger>
                  <TabsTrigger value="despachados" className="text-sm font-medium">Despachados (Entregados)</TabsTrigger>
                </TabsList>

                {/* Filtros Globales (Comunes a las 3 tabs) */}
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por #pedido, cliente o vendedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="space-y-2 flex-1 max-w-xs hidden md:block">
                      <Select value={deliveryTypeFilter} onValueChange={setDeliveryTypeFilter}>
                        <SelectTrigger id="deliveryTypeFilter">
                          <SelectValue placeholder="Filtrar por tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las entregas</SelectItem>
                          {DELIVERY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex-1 max-w-xs hidden md:block">
                      <Select value={deliveryZoneFilter} onValueChange={setDeliveryZoneFilter}>
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
                    {activeTab === "despachados" && (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Desde
                          </span>
                          <Input
                            type="date"
                            value={deliveredDateFrom}
                            onChange={(e) => setDeliveredDateFrom(e.target.value)}
                            className="w-[150px]"
                            aria-label="Fecha de entrega desde"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Hasta
                          </span>
                          <Input
                            type="date"
                            value={deliveredDateTo}
                            onChange={(e) => setDeliveredDateTo(e.target.value)}
                            className="w-[150px]"
                            aria-label="Fecha de entrega hasta"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2 min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        {activeTab === "por_despachar" && <><Truck className="w-5 h-5" /> Productos Listos para Reparto</>}
                        {activeTab === "en_despacho" && <><Truck className="w-5 h-5 text-orange-500" /> Productos En Ruta</>}
                        {activeTab === "despachados" && <><CheckCircle className="w-5 h-5 text-green-500" /> Historial Despachados</>}
                      </CardTitle>
                      <CardDescription>
                        {activeTab === "por_despachar" && "Selecciona los productos y mándalos al camión (En Despacho)."}
                        {activeTab === "en_despacho" && "Productos que ya salieron de tienda. Confirma su entrega aquí."}
                        {activeTab === "despachados" && "Consulta de productos y pedidos entregados exitosamente."}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {activeTab === "despachados" && deliveredRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          void handleExportDispatchedCsv()
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                    )}
                    
                    {/* Botones de acción masiva */}
                    {canMutateDispatchStatus && selectedOrders.size > 0 && activeTab === "por_despachar" && (
                      <Button onClick={() => handleBulkActionClick("to_dispatch")} className="w-full sm:w-auto mt-4 sm:mt-0">
                        <Truck className="mr-2 h-4 w-4" /> Despachar Seleccionados ({selectedOrders.size})
                      </Button>
                    )}
                    {canMutateDispatchStatus && selectedOrders.size > 0 && activeTab === "en_despacho" && (
                      <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                        <Button onClick={() => handleBulkActionClick("to_delivered")} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="mr-2 h-4 w-4" /> Entregar ({selectedOrders.size})
                        </Button>
                        <Button variant="outline" onClick={() => handleBulkActionClick("to_store")}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Devolver
                        </Button>
                      </div>
                    )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">Cargando pedidos...</div>
                    ) : activeTab === "despachados" ? (
                      deliveredRows.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {hasDeliveredDateFilter
                            ? "No hay entregas en el rango de fechas seleccionado"
                            : searchTerm
                              ? "No se encontraron resultados"
                              : "No hay elementos en esta área"}
                        </div>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="whitespace-nowrap">Número de orden</TableHead>
                                <TableHead className="whitespace-nowrap">Fecha de entrega</TableHead>
                                <TableHead>Descripción del producto</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Precio de venta</TableHead>
                                <TableHead className="w-[72px] text-center">
                                  <span className="sr-only">Ver pedido</span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedDeliveredRows.map(({ order, product }) => {
                                const lineKey = `${order.id}|${product.id}`
                                return (
                                  <TableRow key={lineKey}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                      #{order.orderNumber}
                                      {isSistemaApartado(order) && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                                          title="Sistema de Apartado"
                                        >
                                          SA
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm whitespace-nowrap tabular-nums">
                                      {formatDeliveredAtDisplay(product.deliveredAt)}
                                    </TableCell>
                                    <TableCell>
                                      <HoverCard openDelay={200} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <button
                                            type="button"
                                            className="text-left font-medium hover:underline underline-offset-2"
                                          >
                                            {product.name}
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent
                                          className="min-w-[480px] max-w-[min(640px,95vw)] w-max"
                                          align="start"
                                        >
                                          <AttributesGrid
                                            pairs={getProductAttributePairs(product)}
                                            productName={product.name}
                                          />
                                        </HoverCardContent>
                                      </HoverCard>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                      {lineTotalLabels[lineKey] ?? `Bs.${product.total.toFixed(2)}`}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Ver pedido ${order.orderNumber}`}
                                        onClick={() => handleView(order)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    ) : filteredOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "No se encontraron resultados" : "No hay elementos en esta área"}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Cabecera para selección de todos */}
                        {canMutateDispatchStatus &&
                          filteredOrders.some((o) =>
                            o.products.some((p) => getProductDispatchStatus(p) === activeTab),
                          ) && (
                          <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground border-b pb-2 mb-2">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={handleSelectAll}
                              aria-label="Seleccionar todos"
                            />
                            <span>Seleccionar todos los mostrados en esta página</span>
                          </div>
                        )}
                        
                        {paginatedOrders.map((order) => {
                          const activeProducts = order.products.filter(
                            (p) => getProductDispatchStatus(p) === activeTab,
                          )
                          if (activeProducts.length === 0) return null

                          const activeProductKeys = activeProducts.map((p) => `${order.id}|${p.id}`)
                          const isSelected =
                            activeProducts.length > 0 &&
                            activeProductKeys.every((key) => selectedOrders.has(key))
                          const isPartiallySelected =
                            activeProducts.length > 0 &&
                            activeProductKeys.some((key) => selectedOrders.has(key)) &&
                            !isSelected

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
                                open
                                  ? setExpandedOrders((s) => new Set(s).add(order.id))
                                  : setExpandedOrders((s) => {
                                      const n = new Set(s)
                                      n.delete(order.id)
                                      return n
                                    })
                              }
                              showViewDetailsButton={false}
                              orderNumberSuffix={
                                isSistemaApartado(order) ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                                    title="Sistema de Apartado"
                                  >
                                    SA
                                  </Badge>
                                ) : undefined
                              }
                              selectControl={
                                canMutateDispatchStatus && activeProducts.length > 0
                                  ? {
                                      checked: isSelected
                                        ? true
                                        : isPartiallySelected
                                          ? "indeterminate"
                                          : false,
                                      onCheckedChange: () => handleToggleSelect(order.id),
                                      "aria-label": `Seleccionar de ${order.orderNumber}`,
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
                                    <Eye className="w-3 h-3 mr-1" /> Detalles
                                  </Button>

                                  {/* Botón Acción por Orden */}
                                  {activeTab === "por_despachar" && activeProducts.length > 0 && canMutateDispatchStatus && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={(e) => { e.stopPropagation(); handleActionClick(order, "to_dispatch") }}
                                    >
                                      <Truck className="w-3 h-3 mr-1" /> A Ruta
                                    </Button>
                                  )}
                                  {activeTab === "en_despacho" && activeProducts.length > 0 && canMutateDispatchStatus && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={(e) => { e.stopPropagation(); handleActionClick(order, "to_delivered") }}
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" /> Entregar
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-orange-600 hover:bg-orange-50 ml-1"
                                        onClick={(e) => { e.stopPropagation(); handleActionClick(order, "to_store") }}
                                      >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                      </Button>
                                    </>
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
                                    const pTab = getProductDispatchStatus(product)
                                    if (pTab !== activeTab) return null

                                    const isProductSelected = selectedOrders.has(`${order.id}|${product.id}`)

                                    return (
                                      <HoverCard key={product.id} openDelay={200} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <TableRow
                                            className={
                                              canMutateDispatchStatus
                                                ? "hover:bg-muted/50 cursor-pointer"
                                                : "hover:bg-muted/50"
                                            }
                                            onClick={
                                              canMutateDispatchStatus
                                                ? () => handleToggleProduct(order.id, product.id)
                                                : undefined
                                            }
                                          >
                                            <TableCell className="w-[50px]">
                                              {canMutateDispatchStatus ? (
                                                <Checkbox
                                                  checked={isProductSelected}
                                                  onCheckedChange={() => handleToggleProduct(order.id, product.id)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              ) : null}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                              <div className="flex flex-col">
                                                <span>{product.name}</span>
                                                {pTab === "en_despacho" && (
                                                  <span className="text-xs text-orange-600 font-medium flex items-center gap-1 mt-1">
                                                    <Truck className="w-3 h-3" /> En Ruta
                                                  </span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline">{product.category}</Badge>
                                            </TableCell>
                                            <TableCell>{product.quantity}</TableCell>
                                            <TableCell>
                                              {product.locationStatus === "EN DESPACHO" ? (
                                                <Badge className="bg-orange-100 text-orange-800">En Despacho</Badge>
                                              ) : product.locationStatus === "DESPACHADO" ? (
                                                <Badge className="bg-green-100 text-green-800">Entregado</Badge>
                                              ) : (product.manufacturingStatus === "almacen_no_fabricado" ||
                                                (product.manufacturingStatus as string) === "fabricado" || product.locationStatus === "EN TIENDA" || product.locationStatus === "DISPONIBILIDAD INMEDIATA") ? (
                                                <Badge className="bg-blue-100 text-blue-800">Listo (Almacén)</Badge>
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

                    {!isLoading &&
                      ((activeTab === "despachados" && deliveredRows.length > 0) ||
                        (activeTab !== "despachados" && filteredOrders.length > 0)) && (
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
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Dialog Singular */}
      <AlertDialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getModalTitle()}</AlertDialogTitle>
            <AlertDialogDescription>
              {getModalDescription()}
              <br />
              <span className="text-sm font-medium text-foreground mt-4 flex items-center gap-2 flex-wrap">
                Pedido: #{orderToActOn?.orderNumber}
                {orderToActOn && isSistemaApartado(orderToActOn) && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                    title="Sistema de Apartado"
                  >
                    SA
                  </Badge>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToActOn(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteAction}
              className={actionType === "to_delivered" ? "bg-green-600 hover:bg-green-700" : actionType === "to_store" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Masivo */}
      <AlertDialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getModalTitle()} ({selectedOrders.size} selecciones)</AlertDialogTitle>
            <AlertDialogDescription>
              {getModalDescription()}
              <br />
              <span className="text-sm font-medium text-muted-foreground mt-2 block">
                Se aplicará a todos los productos seleccionados de varios pedidos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBulkActionDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteBulkAction}
              className={actionType === "to_delivered" ? "bg-green-600 hover:bg-green-700" : actionType === "to_store" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              Confirmar Masivo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}
