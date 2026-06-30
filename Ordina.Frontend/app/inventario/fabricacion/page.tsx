"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import { Search, Filter, Hammer, CheckCircle2, AlertCircle, Clock, Package, Eye, ChevronDown, ChevronRight, RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getOrders, getOrder, getCategories, type Order, type OrderProduct, type Category, type AttributeValue, updateOrder } from "@/lib/storage"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import {
  SelectProviderDialog,
  type ManufacturingProviderDialogMode,
} from "@/components/manufacturing/select-provider-dialog"
import { useRouter } from "next/navigation"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"
import { PURCHASE_TYPES } from "@/components/orders/constants"
import { isSistemaApartado, isSistemaApartadoReadyForNormalFlow } from "@/lib/order-sa"
import { isReservationOrder } from "@/lib/order-document-types"
import { useAuth } from "@/contexts/auth-context"
import { REPORTE_FABRICACION_LABEL } from "@/lib/manufacturing-labels"

// Tipo para productos agrupados por pedido
interface ProductRow {
  orderId: string
  orderNumber: string
  clientName: string
  orderDate: string
  saleType?: Order["saleType"]
  product: OrderProduct
  status:
    | "disponible"
    | "debe_fabricar"
    | "por_fabricar"
    | "fabricando"
    | "almacen_no_fabricado"
}

function resolveManufacturingRowStatus(
  ms: string | undefined,
): ProductRow["status"] {
  if (ms === "almacen_no_fabricado" || ms === "fabricado") return "almacen_no_fabricado"
  if (ms === "fabricando") return "fabricando"
  if (ms === "por_fabricar") return "por_fabricar"
  return "debe_fabricar"
}

const MANUFACTURING_STATUS_ORDER: Record<ProductRow["status"], number> = {
  debe_fabricar: 0,
  por_fabricar: 1,
  fabricando: 2,
  almacen_no_fabricado: 3,
  disponible: 4,
}

export default function FabricacionPage() {
  const { user } = useAuth()
  const isAdmin =
    user?.role === "Super Administrator" ||
    user?.role === "Administrator"
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<
    "all" | "needs_fabrication" | "ready_for_batch" | "fabricating" | "warehouse"
  >("all")
  const [filterPurchaseType, setFilterPurchaseType] = useState<"all" | "encargo" | "encargo_entrega" | "sistema_apartado">("all")
  const [filterProvider, setFilterProvider] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<{ orderId: string; product: OrderProduct } | null>(null)
  const [selectProviderDialogOpen, setSelectProviderDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkManufactureDialogOpen, setBulkManufactureDialogOpen] = useState(false)
  const [bulkFabricatedDialogOpen, setBulkFabricatedDialogOpen] = useState(false)
  const [bulkRevertDialogOpen, setBulkRevertDialogOpen] = useState(false)
  const [bulkRevertToDebeFabricarDialogOpen, setBulkRevertToDebeFabricarDialogOpen] =
    useState(false)
  const [individualRevertDialogOpen, setIndividualRevertDialogOpen] =
    useState(false)
  const [individualRevertToDebeFabricarDialogOpen, setIndividualRevertToDebeFabricarDialogOpen] =
    useState(false)
  const [revertTarget, setRevertTarget] = useState<{
    orderId: string
    productId: string
  } | null>(null)
  const [revertToDebeFabricarTarget, setRevertToDebeFabricarTarget] = useState<{
    orderId: string
    productId: string
  } | null>(null)
  const [bulkSelectedProvider, setBulkSelectedProvider] = useState<{ id: string; name: string } | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [providerDialogMode, setProviderDialogMode] =
    useState<ManufacturingProviderDialogMode>("start")
  const [bulkProviderDialogMode, setBulkProviderDialogMode] =
    useState<ManufacturingProviderDialogMode>("queue")
  const bulkProviderDialogModeRef = useRef<ManufacturingProviderDialogMode>("queue")
  const [bulkIsRefabrication, setBulkIsRefabrication] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const processingToastIdRef = useRef<string | number | null>(null)
  const processingLockRef = useRef(false)
  const router = useRouter()

  const reportProcessingProgress = useCallback((current: number, total: number) => {
    setProcessingProgress({ current, total })
    const msg = `Procesando ${current} de ${total}...`
    if (processingToastIdRef.current != null) {
      toast.loading(msg, { id: processingToastIdRef.current })
    } else {
      processingToastIdRef.current = toast.loading(msg)
    }
  }, [])

  const beginProcessing = useCallback((total?: number): boolean => {
    if (processingLockRef.current) return false
    processingLockRef.current = true
    setIsProcessing(true)
    if (total != null && total > 0) {
      setProcessingProgress({ current: 0, total })
      processingToastIdRef.current = toast.loading(`Procesando 0 de ${total}...`)
    } else {
      setProcessingProgress(null)
      processingToastIdRef.current = toast.loading("Procesando...")
    }
    return true
  }, [])

  const endProcessing = useCallback(() => {
    processingLockRef.current = false
    if (processingToastIdRef.current != null) {
      toast.dismiss(processingToastIdRef.current)
      processingToastIdRef.current = null
    }
    setIsProcessing(false)
    setProcessingProgress(null)
  }, [])

  const openBulkProviderDialog = (mode: ManufacturingProviderDialogMode) => {
    if (isProcessing) return
    bulkProviderDialogModeRef.current = mode
    setBulkIsRefabrication(mode === "refabrication")
    setBulkProviderDialogMode(mode)
    setBulkManufactureDialogOpen(true)
  }

  useEffect(() => {
    setSelectedProducts(new Set())
  }, [filterStatus, filterPurchaseType, filterProvider])

  // Cargar pedidos y categorías
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedOrders, loadedCategories] = await Promise.all([
          getOrders(),
          getCategories()
        ])
        setOrders(loadedOrders)
        setCategories(loadedCategories)
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Error al cargar los datos")
      }
    }
    loadData()
  }, [])

  // Proveedores únicos (de productos en fabricación)
  const uniqueProviders = useMemo(() => {
    const providers = new Set<string>()
    orders.forEach(order => {
      if (isReservationOrder(order)) return
      if (order.status === "Generado" || order.status === "Generada") return
      order.products.forEach(p => {
        if (p.locationStatus !== "FABRICACION") return
        const name = p.manufacturingProviderName?.trim()
        if (name) providers.add(name)
      })
    })
    return Array.from(providers).sort()
  }, [orders])

  // Procesar pedidos y crear filas de productos
  useEffect(() => {
    const rows: ProductRow[] = []

    orders.forEach(order => {
      if (isReservationOrder(order)) return
      if (order.status === "Generado" || order.status === "Generada") return
      if (isSistemaApartado(order) && !isSistemaApartadoReadyForNormalFlow(order)) {
        return
      }
      order.products.forEach(product => {
        // SOLO procesar productos que deben mandarse a fabricar
        if (product.locationStatus !== "FABRICACION") {
          return // Saltar productos en tienda
        }

        const status = resolveManufacturingRowStatus(
          product.manufacturingStatus as string | undefined,
        )

        // Agregar producto a la lista
        rows.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientName: order.clientName,
          orderDate: order.createdAt,
          saleType: order.saleType,
          product,
          status
        })
      })
    })

    // Filtrar según estado seleccionado
    let filtered = rows
    if (filterStatus !== "all") {
      filtered = rows.filter(row => {
        if (filterStatus === "needs_fabrication") return row.status === "debe_fabricar"
        if (filterStatus === "ready_for_batch") return row.status === "por_fabricar"
        if (filterStatus === "fabricating") return row.status === "fabricando"
        if (filterStatus === "warehouse") return row.status === "almacen_no_fabricado"
        return true
      })
    }

    // Filtrar por búsqueda (incluye proveedor)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.orderNumber.toLowerCase().includes(term) ||
        row.clientName.toLowerCase().includes(term) ||
        row.product.name.toLowerCase().includes(term) ||
        (row.product.manufacturingProviderName?.toLowerCase().includes(term) ?? false)
      )
    }

    // Filtrar por proveedor
    if (filterProvider !== "all") {
      filtered = filtered.filter(row => {
        const provider = row.product.manufacturingProviderName?.trim() || ""
        if (filterProvider === "unassigned") return !provider
        return provider === filterProvider
      })
    }

    // Tipo de venta (Encargo, Encargo/Entrega, SA)
    if (filterPurchaseType !== "all") {
      filtered = filtered.filter((row) => row.saleType === filterPurchaseType)
    }

    // Ordenar: primero por ESTADO (Debe Fabricar → Fabricando → En almacén), luego por pedido
    filtered.sort((a, b) => {
      const statusDiff =
        MANUFACTURING_STATUS_ORDER[a.status] - MANUFACTURING_STATUS_ORDER[b.status]
      if (statusDiff !== 0) return statusDiff
      return a.orderNumber.localeCompare(b.orderNumber)
    })

    setProductRows(filtered)
  }, [orders, filterStatus, filterPurchaseType, filterProvider, searchTerm])

  // Paginación
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedRows,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({
    data: productRows,
    itemsPerPage,
  })

  // Obtener badge de estado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "disponible":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Listo
          </Badge>
        )
      case "debe_fabricar":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Debe Fabricar
          </Badge>
        )
      case "por_fabricar":
        return (
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
            <Package className="w-3 h-3 mr-1" />
            {REPORTE_FABRICACION_LABEL}
          </Badge>
        )
      case "fabricando":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Fabricando
          </Badge>
        )
      case "almacen_no_fabricado":
        return (
          <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Package className="w-3 h-3 mr-1" />
            En almacén
          </Badge>
        )
      default:
        return null
    }
  }

  // Obtener categoría para producto
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

  // Componente para mostrar atributos en grid (5 columnas, filas según cantidad)
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

  const ensureOrderReadyForManufacturing = (orderId: string): Order | null => {
    const order = orders.find((o) => o.id === orderId)
    if (order && !isSistemaApartadoReadyForNormalFlow(order)) {
      toast.error(
        "Sistema de Apartado: liquida el saldo en el pedido para continuar con la fabricación",
      )
      return null
    }
    return order ?? null
  }

  const handleSendToQueueClick = (orderId: string, product: OrderProduct) => {
    if (isProcessing) return
    if (!ensureOrderReadyForManufacturing(orderId)) return
    setSelectedProduct({ orderId, product })
    setProviderDialogMode("queue")
    setSelectProviderDialogOpen(true)
  }

  const handleStartManufacturingClick = async (
    orderId: string,
    product: OrderProduct,
  ) => {
    if (isProcessing) return
    if (!ensureOrderReadyForManufacturing(orderId)) return

    if (product.manufacturingProviderId && product.manufacturingProviderName) {
      if (!beginProcessing()) return
      try {
        const order = await getOrder(orderId)
        if (!order) throw new Error("Pedido no encontrado")
        const idx = order.products.findIndex((p) => p.id === product.id)
        if (idx === -1) throw new Error("Producto no encontrado")
        await updateOrder(order.id, {
          products: order.products.map((p, i) =>
            i === idx
              ? buildProductStartingManufacturing(p, {
                  providerId: product.manufacturingProviderId!,
                  providerName: product.manufacturingProviderName!,
                })
              : p,
          ),
        })
        const loadedOrders = await getOrders()
        setOrders(loadedOrders)
        toast.success("Producto en fabricación")
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error al actualizar el estado"
        toast.error(message)
      } finally {
        endProcessing()
      }
      return
    }

    setSelectedProduct({ orderId, product })
    setProviderDialogMode("start")
    setSelectProviderDialogOpen(true)
  }

  const handleRefabricationClick = (orderId: string, product: OrderProduct) => {
    if (isProcessing) return
    if (!ensureOrderReadyForManufacturing(orderId)) return
    setSelectedProduct({ orderId, product })
    setProviderDialogMode("refabrication")
    setSelectProviderDialogOpen(true)
  }

  const buildProductQueuedForManufacturing = (
    current: OrderProduct,
    providerId: string,
    providerName: string,
    notes?: string,
  ): OrderProduct => ({
    ...current,
    manufacturingStatus: "por_fabricar",
    ...(providerId
      ? {
          manufacturingProviderId: providerId,
          manufacturingProviderName: providerName,
        }
      : {}),
    ...(notes !== undefined ? { manufacturingNotes: notes } : {}),
  })

  const buildProductStartingManufacturing = (
    current: OrderProduct,
    opts: {
      providerId: string
      providerName: string
      notes?: string
      refabricationReason?: string
      isRefabrication?: boolean
    },
  ): OrderProduct => {
    const updated: OrderProduct = {
      ...current,
      availabilityStatus: "no_disponible",
      manufacturingStatus: "fabricando",
      manufacturingProviderId: opts.providerId,
      manufacturingProviderName: opts.providerName,
      manufacturingStartedAt: new Date().toISOString(),
      manufacturingNotes: opts.notes,
      logisticStatus: "Fabricándose",
      manufacturingCompletedAt: undefined,
    }

    if (opts.isRefabrication && opts.refabricationReason) {
      updated.refabricationReason = opts.refabricationReason
      updated.refabricatedAt = new Date().toISOString()
      updated.refabricationHistory = [
        ...(current.refabricationHistory || []),
        {
          reason: opts.refabricationReason,
          date: new Date().toISOString(),
          previousProviderId: current.manufacturingProviderId,
          previousProviderName: current.manufacturingProviderName,
          newProviderId: opts.providerId,
          newProviderName: opts.providerName,
        },
      ]
    }

    return updated
  }

  const buildProductRevertToPorFabricar = (
    current: OrderProduct,
  ): OrderProduct => ({
    ...current,
    manufacturingStatus: "por_fabricar",
    manufacturingStartedAt: undefined,
    manufacturingCompletedAt: undefined,
    logisticStatus:
      current.logisticStatus === "Fabricándose"
        ? "Validado"
        : current.logisticStatus,
  })

  const buildProductRevertToDebeFabricar = (
    current: OrderProduct,
  ): OrderProduct => ({
    ...current,
    manufacturingStatus: "debe_fabricar",
    manufacturingProviderId: undefined,
    manufacturingProviderName: undefined,
    manufacturingNotes: undefined,
    manufacturingStartedAt: undefined,
    manufacturingCompletedAt: undefined,
  })

  const handleProviderDialogConfirm = async (
    providerId: string,
    providerName: string,
    notes?: string,
    refabricationReason?: string,
  ) => {
    if (isProcessing || !selectedProduct) return

    const snapshot = selectedProduct
    const mode = providerDialogMode
    setSelectProviderDialogOpen(false)
    setSelectedProduct(null)
    if (!beginProcessing()) return

    try {
      const order = await getOrder(snapshot.orderId)
      if (!order) throw new Error("Pedido no encontrado")
      if (!isSistemaApartadoReadyForNormalFlow(order)) {
        toast.error(
          "Sistema de Apartado: liquida el saldo en el pedido para continuar con la fabricación",
        )
        return
      }

      const productIndex = order.products.findIndex(
        (p) => p.id === snapshot.product.id,
      )
      if (productIndex === -1) throw new Error("Producto no encontrado")

      const currentProduct = order.products[productIndex]
      let updatedProduct: OrderProduct

      if (mode === "queue") {
        const rowStatus = resolveManufacturingRowStatus(
          currentProduct.manufacturingStatus,
        )
        if (rowStatus !== "debe_fabricar") {
          throw new Error("El producto ya no está en Debe fabricar")
        }
        updatedProduct = buildProductQueuedForManufacturing(
          currentProduct,
          providerId,
          providerName,
          notes,
        )
      } else if (mode === "start") {
        if (!providerId) {
          toast.error("Selecciona un proveedor para iniciar la fabricación")
          return
        }
        const rowStatus = resolveManufacturingRowStatus(
          currentProduct.manufacturingStatus,
        )
        if (rowStatus !== "por_fabricar") {
          throw new Error(`El producto debe estar en ${REPORTE_FABRICACION_LABEL}`)
        }
        updatedProduct = buildProductStartingManufacturing(currentProduct, {
          providerId,
          providerName,
          notes,
        })
      } else {
        if (!providerId) {
          toast.error("Selecciona un proveedor")
          return
        }
        updatedProduct = buildProductStartingManufacturing(currentProduct, {
          providerId,
          providerName,
          notes,
          refabricationReason,
          isRefabrication: true,
        })
      }

      const updatedProducts = [...order.products]
      updatedProducts[productIndex] = updatedProduct

      await updateOrder(order.id, { products: updatedProducts })

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)

      const successMessage =
        mode === "queue"
          ? `Producto enviado a ${REPORTE_FABRICACION_LABEL}`
          : mode === "refabrication"
            ? `Producto reiniciado a fabricación con ${providerName}`
            : `Producto en fabricación con ${providerName}`
      toast.success(successMessage)
    } catch (error: unknown) {
      console.error("Error updating manufacturing status:", error)
      const message =
        error instanceof Error ? error.message : "Error al actualizar el estado de fabricación"
      toast.error(message)
    } finally {
      endProcessing()
    }
  }

  // Marcar como En almacén (último paso de fabricación)
  const handleMarkAsFabricated = async (orderId: string, productId: string) => {
    if (isProcessing) return
    if (!beginProcessing()) return
    try {
      const order = await getOrder(orderId)
      if (!order) throw new Error("Pedido no encontrado")
      if (!isSistemaApartadoReadyForNormalFlow(order)) {
        toast.error("Sistema de Apartado: liquida el saldo en el pedido para continuar con la fabricación")
        return
      }

      const productIndex = order.products.findIndex(p => p.id === productId)
      if (productIndex === -1) throw new Error("Producto no encontrado")

      const updatedProduct = {
        ...order.products[productIndex],
        manufacturingStatus: "almacen_no_fabricado" as const,
        logisticStatus: "En Almacén", // Sincronizar estado logístico
        manufacturingCompletedAt: new Date().toISOString(),
      }

      const updatedProducts = [...order.products]
      updatedProducts[productIndex] = updatedProduct

      await updateOrder(order.id, {
        products: updatedProducts
      })
      
      const loadedOrders = await getOrders()
      setOrders(loadedOrders)

      toast.success("Producto marcado como En almacén")
    } catch (error: any) {
      console.error("Error marking as fabricated:", error)
      toast.error(error.message || "Error al actualizar el estado")
    } finally {
      endProcessing()
    }
  }

  const revertProductInOrder = async (
    orderId: string,
    productId: string,
  ): Promise<boolean> => {
    const order = await getOrder(orderId)
    if (!order) throw new Error("Pedido no encontrado")
    if (!isSistemaApartadoReadyForNormalFlow(order)) {
      toast.error(
        "Sistema de Apartado: liquida el saldo en el pedido para continuar con la fabricación",
      )
      return false
    }

    const productIndex = order.products.findIndex((p) => p.id === productId)
    if (productIndex === -1) throw new Error("Producto no encontrado")

    const currentProduct = order.products[productIndex]
    if (resolveManufacturingRowStatus(currentProduct.manufacturingStatus) !== "fabricando") {
      throw new Error("El producto debe estar en Fabricando")
    }

    const updatedProducts = [...order.products]
    updatedProducts[productIndex] =
      buildProductRevertToPorFabricar(currentProduct)

    await updateOrder(order.id, { products: updatedProducts })
    return true
  }

  const revertProductToDebeFabricarInOrder = async (
    orderId: string,
    productId: string,
  ): Promise<boolean> => {
    const order = await getOrder(orderId)
    if (!order) throw new Error("Pedido no encontrado")
    if (!isSistemaApartadoReadyForNormalFlow(order)) {
      toast.error(
        "Sistema de Apartado: liquida el saldo en el pedido para continuar con la fabricación",
      )
      return false
    }

    const productIndex = order.products.findIndex((p) => p.id === productId)
    if (productIndex === -1) throw new Error("Producto no encontrado")

    const currentProduct = order.products[productIndex]
    if (resolveManufacturingRowStatus(currentProduct.manufacturingStatus) !== "por_fabricar") {
      throw new Error(`El producto debe estar en ${REPORTE_FABRICACION_LABEL}`)
    }

    const updatedProducts = [...order.products]
    updatedProducts[productIndex] =
      buildProductRevertToDebeFabricar(currentProduct)

    await updateOrder(order.id, { products: updatedProducts })
    return true
  }

  const handleRevertToPorFabricarClick = (
    orderId: string,
    productId: string,
  ) => {
    if (isProcessing) return
    setRevertTarget({ orderId, productId })
    setIndividualRevertDialogOpen(true)
  }

  const handleConfirmIndividualRevert = async () => {
    if (!revertTarget || isProcessing) return

    if (!beginProcessing()) return
    try {
      const ok = await revertProductInOrder(
        revertTarget.orderId,
        revertTarget.productId,
      )
      if (!ok) return

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      toast.success(`Producto devuelto a ${REPORTE_FABRICACION_LABEL}`)
    } catch (error: unknown) {
      console.error("Error reverting manufacturing status:", error)
      const message =
        error instanceof Error
          ? error.message
          : `Error al devolver el producto a ${REPORTE_FABRICACION_LABEL}`
      toast.error(message)
    } finally {
      endProcessing()
      setIndividualRevertDialogOpen(false)
      setRevertTarget(null)
    }
  }

  const handleRevertToDebeFabricarClick = (
    orderId: string,
    productId: string,
  ) => {
    if (isProcessing) return
    setRevertToDebeFabricarTarget({ orderId, productId })
    setIndividualRevertToDebeFabricarDialogOpen(true)
  }

  const handleConfirmIndividualRevertToDebeFabricar = async () => {
    if (!revertToDebeFabricarTarget || isProcessing) return

    if (!beginProcessing()) return
    try {
      const ok = await revertProductToDebeFabricarInOrder(
        revertToDebeFabricarTarget.orderId,
        revertToDebeFabricarTarget.productId,
      )
      if (!ok) return

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      toast.success("Producto devuelto a Debe fabricar")
    } catch (error: unknown) {
      console.error("Error reverting to debe fabricar:", error)
      const message =
        error instanceof Error
          ? error.message
          : "Error al devolver el producto a Debe fabricar"
      toast.error(message)
    } finally {
      endProcessing()
      setIndividualRevertToDebeFabricarDialogOpen(false)
      setRevertToDebeFabricarTarget(null)
    }
  }

  const handleBulkRevertToPorFabricarClick = () => {
    if (isProcessing) return
    if (getSelectedProductsForFabricated().length === 0) {
      toast.error(
        "Solo se pueden devolver productos con estado 'Fabricando'",
      )
      return
    }
    setBulkRevertDialogOpen(true)
  }

  const executeBulkRevertToPorFabricar = async () => {
    const selectedKeys = getSelectedProductsForFabricated()
    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const ok = await revertProductInOrder(orderId, productId)
          if (ok) successCount++
        } catch (error) {
          console.error(`Error revirtiendo producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())
      setBulkRevertDialogOpen(false)

      if (errorCount === 0) {
        toast.success(
          `${successCount} producto(s) devuelto(s) a ${REPORTE_FABRICACION_LABEL}`,
        )
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  // Agrupar productos por pedido (solo los paginados)
  const groupedRows = paginatedRows.reduce((acc, row) => {
    if (!acc[row.orderId]) {
      acc[row.orderId] = {
        orderNumber: row.orderNumber,
        clientName: row.clientName,
        orderDate: row.orderDate,
        saleType: row.saleType,
        products: [],
      }
    }
    acc[row.orderId].products.push(row)
    return acc
  }, {} as Record<
    string,
    {
      orderNumber: string
      clientName: string
      orderDate: string
      saleType?: Order["saleType"]
      products: ProductRow[]
    }
  >)

  // Función para toggle del acordeón
  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  // Manejar selección individual de productos
  const handleToggleSelect = (orderId: string, productId: string) => {
    if (isProcessing) return
    const key = `${orderId}|${productId}`
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Manejar selección de todos los productos filtrados (solo los paginados)
  const handleSelectAll = (checked: boolean) => {
    if (isProcessing) return
    if (checked) {
      const keys = paginatedRows.map(row => `${row.orderId}|${row.product.id}`)
      setSelectedProducts(new Set(keys))
    } else {
      setSelectedProducts(new Set())
    }
  }

  // Manejar selección de todos los productos de un pedido
  const handleToggleSelectOrder = (orderId: string) => {
    if (isProcessing) return
    const orderProducts = paginatedRows.filter(row => row.orderId === orderId)
    const orderProductKeys = orderProducts.map(row => `${row.orderId}|${row.product.id}`)
    
    // Verificar si todos los productos del pedido están seleccionados
    const allSelected = orderProductKeys.length > 0 && orderProductKeys.every(key => selectedProducts.has(key))
    
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // Deseleccionar todos los productos del pedido
        orderProductKeys.forEach(key => newSet.delete(key))
      } else {
        // Seleccionar todos los productos del pedido
        orderProductKeys.forEach(key => newSet.add(key))
      }
      return newSet
    })
  }

  // Verificar si todos los productos de un pedido están seleccionados
  const isOrderFullySelected = (orderId: string): boolean => {
    const orderProducts = paginatedRows.filter(row => row.orderId === orderId)
    if (orderProducts.length === 0) return false
    
    const orderProductKeys = orderProducts.map(row => `${row.orderId}|${row.product.id}`)
    return orderProductKeys.every(key => selectedProducts.has(key))
  }

  // Verificar si algunos (pero no todos) productos de un pedido están seleccionados
  const isOrderPartiallySelected = (orderId: string): boolean => {
    const orderProducts = paginatedRows.filter(row => row.orderId === orderId)
    if (orderProducts.length === 0) return false
    
    const orderProductKeys = orderProducts.map(row => `${row.orderId}|${row.product.id}`)
    const selectedCount = orderProductKeys.filter(key => selectedProducts.has(key)).length
    return selectedCount > 0 && selectedCount < orderProductKeys.length
  }

  // Manejar click en "Mandar a Fabricar" (masivo)
  const handleBulkManufacture = () => {
    if (isProcessing) return
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    // Filtrar solo productos que estén en "debe_fabricar"
    const selectedKeys = Array.from(selectedProducts)
    const validProducts = selectedKeys.filter(key => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "debe_fabricar"
    })

    if (validProducts.length === 0) {
      toast.error("Solo se pueden enviar productos con estado 'Debe Fabricar'")
      return
    }

    openBulkProviderDialog("queue")
  }

  const handleBulkStartManufacturing = async () => {
    if (isProcessing) return
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    const validKeys = getSelectedProductsForStartManufacturing()
    if (validKeys.length === 0) {
      toast.error(`Solo se pueden iniciar productos en ${REPORTE_FABRICACION_LABEL}`)
      return
    }

    const keysNeedingProvider = validKeys.filter((key) => {
      const [orderId, productId] = key.split("|")
      const row = productRows.find(
        (r) => r.orderId === orderId && r.product.id === productId,
      )
      return (
        row &&
        !row.product.manufacturingProviderId?.trim() &&
        !row.product.manufacturingProviderName?.trim()
      )
    })

    if (keysNeedingProvider.length === 0) {
      await executeBulkStartManufactureWithExistingProviders(validKeys)
      return
    }

    if (keysNeedingProvider.length < validKeys.length) {
      await executeBulkStartManufactureWithExistingProviders(
        validKeys.filter((key) => !keysNeedingProvider.includes(key)),
      )
    }

    openBulkProviderDialog("start")
  }

  // Manejar click en "Marcar como Fabricado" (masivo)
  const handleBulkMarkAsFabricated = () => {
    if (isProcessing) return
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    // Filtrar solo productos que estén en "fabricando"
    const selectedKeys = Array.from(selectedProducts)
    const validProducts = selectedKeys.filter(key => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "fabricando"
    })

    if (validProducts.length === 0) {
      toast.error("Solo se pueden marcar como fabricados productos con estado 'Fabricando'")
      return
    }

    setBulkFabricatedDialogOpen(true)
  }

  const executeBulkSendToQueue = async (
    providerId: string,
    providerName: string,
    notes?: string,
  ) => {
    const selectedKeys = getSelectedProductsForManufacture()
    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const order = await getOrder(orderId)
          if (!order || !isSistemaApartadoReadyForNormalFlow(order)) {
            errorCount++
            continue
          }

          const productIndex = order.products.findIndex((p) => p.id === productId)
          if (productIndex === -1) {
            errorCount++
            continue
          }

          const current = order.products[productIndex]
          if (resolveManufacturingRowStatus(current.manufacturingStatus) !== "debe_fabricar") {
            continue
          }

          const updatedProducts = [...order.products]
          updatedProducts[productIndex] = buildProductQueuedForManufacturing(
            current,
            providerId,
            providerName,
            notes,
          )

          await updateOrder(order.id, { products: updatedProducts })
          successCount++
        } catch (error) {
          console.error(`Error actualizando producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())
      setBulkManufactureDialogOpen(false)
      setBulkSelectedProvider(null)

      if (errorCount === 0) {
        toast.success(`${successCount} producto(s) enviado(s) a ${REPORTE_FABRICACION_LABEL}`)
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  const executeBulkStartManufactureWithProvider = async (
    selectedKeys: string[],
    opts: { providerId: string; providerName: string; notes?: string },
  ) => {
    if (!opts.providerId) {
      toast.error("Selecciona un proveedor para iniciar la fabricación")
      return
    }

    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const order = await getOrder(orderId)
          if (!order || !isSistemaApartadoReadyForNormalFlow(order)) {
            errorCount++
            continue
          }

          const productIndex = order.products.findIndex((p) => p.id === productId)
          if (productIndex === -1) {
            errorCount++
            continue
          }

          const current = order.products[productIndex]
          if (resolveManufacturingRowStatus(current.manufacturingStatus) !== "por_fabricar") {
            continue
          }

          const updatedProducts = [...order.products]
          updatedProducts[productIndex] = buildProductStartingManufacturing(current, {
            providerId: opts.providerId,
            providerName: opts.providerName,
            notes: opts.notes,
          })

          await updateOrder(order.id, { products: updatedProducts })
          successCount++
        } catch (error) {
          console.error(`Error actualizando producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())
      setBulkManufactureDialogOpen(false)
      setBulkSelectedProvider(null)

      if (errorCount === 0) {
        toast.success(`${successCount} producto(s) en fabricación`)
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  const executeBulkStartManufactureWithExistingProviders = async (
    selectedKeys: string[],
  ) => {
    if (selectedKeys.length === 0) return

    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const order = await getOrder(orderId)
          if (!order || !isSistemaApartadoReadyForNormalFlow(order)) {
            errorCount++
            continue
          }

          const productIndex = order.products.findIndex((p) => p.id === productId)
          if (productIndex === -1) {
            errorCount++
            continue
          }

          const current = order.products[productIndex]
          if (resolveManufacturingRowStatus(current.manufacturingStatus) !== "por_fabricar") {
            continue
          }

          const providerId = current.manufacturingProviderId?.trim()
          const providerName = current.manufacturingProviderName?.trim()
          if (!providerId || !providerName) {
            continue
          }

          const updatedProducts = [...order.products]
          updatedProducts[productIndex] = buildProductStartingManufacturing(current, {
            providerId,
            providerName,
          })

          await updateOrder(order.id, { products: updatedProducts })
          successCount++
        } catch (error) {
          console.error(`Error actualizando producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())

      if (successCount === 0 && errorCount === 0) {
        return
      }

      if (errorCount === 0) {
        toast.success(`${successCount} producto(s) en fabricación`)
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  const executeBulkStartManufacture = async (
    providerId: string,
    providerName: string,
    notes?: string,
  ) => {
    const selectedKeys = getSelectedProductsForStartManufacturing().filter((key) => {
      const [orderId, productId] = key.split("|")
      const row = productRows.find(
        (r) => r.orderId === orderId && r.product.id === productId,
      )
      return (
        row &&
        !row.product.manufacturingProviderId?.trim() &&
        !row.product.manufacturingProviderName?.trim()
      )
    })

    if (selectedKeys.length === 0) {
      toast.error("No hay productos pendientes de proveedor en la selección")
      return
    }

    await executeBulkStartManufactureWithProvider(selectedKeys, {
      providerId,
      providerName,
      notes,
    })
  }

  // Ejecutar acción masiva de "marcar como fabricado"
  const executeBulkMarkAsFabricated = async () => {
    const selectedKeys = Array.from(selectedProducts)
    setBulkFabricatedDialogOpen(false)
    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const order = await getOrder(orderId)
          if (!order) {
            errorCount++
            continue
          }
          if (!isSistemaApartadoReadyForNormalFlow(order)) {
            continue
          }

          const productIndex = order.products.findIndex((p) => p.id === productId)
          if (productIndex === -1) {
            errorCount++
            continue
          }

          if (order.products[productIndex].manufacturingStatus !== "fabricando") {
            continue
          }

          const updatedProduct = {
            ...order.products[productIndex],
            manufacturingStatus: "almacen_no_fabricado" as const,
            logisticStatus: "En Almacén",
            manufacturingCompletedAt: new Date().toISOString(),
          }

          const updatedProducts = [...order.products]
          updatedProducts[productIndex] = updatedProduct

          await updateOrder(order.id, { products: updatedProducts })
          successCount++
        } catch (error) {
          console.error(`Error actualizando producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())

      if (errorCount === 0) {
        toast.success(`${successCount} producto(s) marcado(s) como fabricado(s)`)
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  const handleBulkRevertToDebeFabricarClick = () => {
    if (isProcessing) return
    if (getSelectedProductsForStartManufacturing().length === 0) {
      toast.error(
        `Solo se pueden devolver productos con estado '${REPORTE_FABRICACION_LABEL}'`,
      )
      return
    }
    setBulkRevertToDebeFabricarDialogOpen(true)
  }

  const executeBulkRevertToDebeFabricar = async () => {
    const selectedKeys = getSelectedProductsForStartManufacturing()
    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const ok = await revertProductToDebeFabricarInOrder(orderId, productId)
          if (ok) successCount++
        } catch (error) {
          console.error(`Error revirtiendo producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)

      if (successCount > 0) {
        toast.success(
          `${successCount} producto(s) devuelto(s) a Debe fabricar`,
        )
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} producto(s) no se pudieron devolver`)
      }
      setBulkRevertToDebeFabricarDialogOpen(false)
      setSelectedProducts(new Set())
    } finally {
      endProcessing()
    }
  }

  // Calcular si todos están seleccionados (solo los paginados)
  const allSelected = paginatedRows.length > 0 && selectedProducts.size === paginatedRows.length
  const someSelected = selectedProducts.size > 0 && selectedProducts.size < paginatedRows.length

  // Obtener productos seleccionados válidos para cada acción
  const getSelectedProductsForManufacture = () => {
    return Array.from(selectedProducts).filter((key) => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find((r) => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "debe_fabricar"
    })
  }

  const getSelectedProductsForStartManufacturing = () => {
    return Array.from(selectedProducts).filter((key) => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find(
        (r) => r.orderId === orderId && r.product.id === productId,
      )
      return row && row.status === "por_fabricar"
    })
  }

  const getSelectedProductsForFabricated = () => {
    return Array.from(selectedProducts).filter((key) => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find((r) => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "fabricando"
    })
  }

  // Obtener productos seleccionados válidos para refabricación (en almacén)
  const getSelectedProductsForRefabrication = () => {
    return Array.from(selectedProducts).filter((key) => {
      const [orderId, productId] = key.split("|")
      const order = orders.find((o) => o.id === orderId)
      if (!order || !isSistemaApartadoReadyForNormalFlow(order)) return false
      const row = productRows.find((r) => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "almacen_no_fabricado"
    })
  }

  // Manejar click en "Reiniciar Fabricación" (masivo)
  const handleBulkRefabrication = () => {
    if (isProcessing) return
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    // Filtrar solo productos que estén en "almacen_no_fabricado"
    const validProducts = getSelectedProductsForRefabrication()

    if (validProducts.length === 0) {
      toast.error("Solo se pueden refabricar productos con estado 'En almacén'")
      return
    }

    openBulkProviderDialog("refabrication")
  }

  const handleBulkProviderDialogConfirm = (
    providerId: string,
    providerName: string,
    notes?: string,
    refabricationReason?: string,
  ) => {
    const mode = bulkProviderDialogModeRef.current
    const wasRefabrication = bulkIsRefabrication || mode === "refabrication"
    setBulkManufactureDialogOpen(false)
    setBulkIsRefabrication(false)

    if (wasRefabrication) {
      void executeBulkRefabrication(providerId, providerName, notes, refabricationReason)
      return
    }
    if (mode === "queue") {
      void executeBulkSendToQueue(providerId, providerName, notes)
      return
    }
    void executeBulkStartManufacture(providerId, providerName, notes)
  }

  // Ejecutar acción masiva de refabricación
  const executeBulkRefabrication = async (providerId: string, providerName: string, notes?: string, refabricationReason?: string) => {
    if (!refabricationReason) {
      toast.error("La razón de refabricación es obligatoria")
      return
    }

    const selectedKeys = getSelectedProductsForRefabrication()
    if (!beginProcessing(selectedKeys.length)) return
    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i]
        reportProcessingProgress(i + 1, selectedKeys.length)
        const [orderId, productId] = key.split("|")
        try {
          const order = await getOrder(orderId)
          if (!order) {
            errorCount++
            continue
          }
          if (!isSistemaApartadoReadyForNormalFlow(order)) {
            continue
          }

          const productIndex = order.products.findIndex((p) => p.id === productId)
          if (productIndex === -1) {
            errorCount++
            continue
          }

          const currentProduct = order.products[productIndex]

          if (
            currentProduct.manufacturingStatus !== "almacen_no_fabricado" &&
            (currentProduct.manufacturingStatus as string) !== "fabricado"
          ) {
            continue
          }

          const historyRecord = {
            reason: refabricationReason,
            date: new Date().toISOString(),
            previousProviderId: currentProduct.manufacturingProviderId,
            previousProviderName: currentProduct.manufacturingProviderName,
            newProviderId: providerId,
            newProviderName: providerName,
          }

          const updatedProduct: OrderProduct = {
            ...currentProduct,
            availabilityStatus: "no_disponible" as const,
            manufacturingStatus: "fabricando" as const,
            manufacturingProviderId: providerId,
            manufacturingProviderName: providerName,
            manufacturingStartedAt: new Date().toISOString(),
            manufacturingNotes: notes,
            logisticStatus: "Fabricándose",
            manufacturingCompletedAt: undefined,
            refabricationReason: refabricationReason,
            refabricatedAt: new Date().toISOString(),
            refabricationHistory: [
              ...(currentProduct.refabricationHistory || []),
              historyRecord,
            ],
          }

          const updatedProducts = [...order.products]
          updatedProducts[productIndex] = updatedProduct

          await updateOrder(order.id, { products: updatedProducts })
          successCount++
        } catch (error) {
          console.error(`Error refabricando producto ${productId}:`, error)
          errorCount++
        }
      }

      const loadedOrders = await getOrders()
      setOrders(loadedOrders)
      setSelectedProducts(new Set())

      if (errorCount === 0) {
        toast.success(`${successCount} producto(s) reiniciado(s) a fabricación`)
      } else {
        toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
      }
    } finally {
      endProcessing()
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Fabricación</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                  <Hammer className="w-6 h-6" />
                  Fabricación
                </h1>
                <p className="text-muted-foreground">
                  Gestiona la fabricación de productos agrupados por pedido
                </p>
              </div>
            </div>

            {isProcessing && (
              <div
                className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {processingProgress
                  ? `Procesando ${processingProgress.current} de ${processingProgress.total}...`
                  : "Procesando..."}
              </div>
            )}

            {/* Filtros */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Buscar por pedido, cliente, producto o proveedor..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filtros:</span>
                    </div>

                    <Select
                      value={filterStatus}
                      onValueChange={(v: typeof filterStatus) => setFilterStatus(v)}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="needs_fabrication">Debe Fabricar</SelectItem>
                        <SelectItem value="ready_for_batch">{REPORTE_FABRICACION_LABEL}</SelectItem>
                        <SelectItem value="fabricating">Fabricando</SelectItem>
                        <SelectItem value="warehouse">En almacén</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterPurchaseType}
                      onValueChange={(v: typeof filterPurchaseType) => setFilterPurchaseType(v)}
                    >
                      <SelectTrigger className="w-full min-w-0 sm:min-w-[12rem] sm:max-w-[20rem]">
                        <SelectValue placeholder="Tipo de venta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos de venta</SelectItem>
                        {PURCHASE_TYPES.filter(
                          (t) =>
                            t.value === "encargo" ||
                            t.value === "encargo_entrega" ||
                            t.value === "sistema_apartado"
                        ).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterProvider} onValueChange={setFilterProvider}>
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {uniqueProviders.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción masiva */}
            {selectedProducts.size > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-2">
                    {(filterStatus === "all" || filterStatus === "needs_fabrication") &&
                      getSelectedProductsForManufacture().length > 0 && (
                      <Button
                        onClick={handleBulkManufacture}
                        disabled={isProcessing}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Hammer className="w-4 h-4 mr-2" />
                        Enviar a fabricar ({getSelectedProductsForManufacture().length})
                      </Button>
                    )}
                    {(filterStatus === "all" || filterStatus === "ready_for_batch") &&
                      getSelectedProductsForStartManufacturing().length > 0 && (
                      <Button
                        onClick={handleBulkStartManufacturing}
                        disabled={isProcessing}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Hammer className="w-4 h-4 mr-2" />
                        En fabricación ({getSelectedProductsForStartManufacturing().length})
                      </Button>
                    )}
                    {isAdmin &&
                      (filterStatus === "all" || filterStatus === "ready_for_batch") &&
                      getSelectedProductsForStartManufacturing().length > 0 && (
                      <Button
                        onClick={handleBulkRevertToDebeFabricarClick}
                        disabled={isProcessing}
                        variant="outline"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Devolver a Debe fabricar ({getSelectedProductsForStartManufacturing().length})
                      </Button>
                    )}
                    {(filterStatus === "all" || filterStatus === "fabricating") &&
                      getSelectedProductsForFabricated().length > 0 && (
                      <Button
                        onClick={handleBulkMarkAsFabricated}
                        disabled={isProcessing}
                        variant="outline"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Marcar como Fabricado ({getSelectedProductsForFabricated().length})
                      </Button>
                    )}
                    {isAdmin &&
                      (filterStatus === "all" || filterStatus === "fabricating") &&
                      getSelectedProductsForFabricated().length > 0 && (
                      <Button
                        onClick={handleBulkRevertToPorFabricarClick}
                        disabled={isProcessing}
                        variant="outline"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Devolver a {REPORTE_FABRICACION_LABEL} ({getSelectedProductsForFabricated().length})
                      </Button>
                    )}
                    {(filterStatus === "all" || filterStatus === "warehouse") &&
                      getSelectedProductsForRefabrication().length > 0 && (
                      <Button
                        onClick={handleBulkRefabrication}
                        disabled={isProcessing}
                        variant="destructive"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reiniciar Fabricación ({getSelectedProductsForRefabrication().length})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={isProcessing}
                      onClick={() => setSelectedProducts(new Set())}
                    >
                      Limpiar Selección
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabla de productos agrupados por pedido */}
            {productRows.length === 0 ? (
              <Card className="p-8 text-center">
                <CardContent>
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay productos para fabricar</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || filterStatus !== "all" || filterPurchaseType !== "all" || filterProvider !== "all"
                      ? "Intenta ajustar los filtros de búsqueda"
                      : "Todos los productos están disponibles"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Productos en Fabricación</CardTitle>
                  <CardDescription>
                    {totalItems} producto(s) encontrado(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(groupedRows).map(([orderId, group]) => {
                      const isExpanded = expandedOrders.has(orderId)
                      const totalProducts = group.products.length

                      const statusCount = {
                        debe_fabricar: group.products.filter((r) => r.status === "debe_fabricar").length,
                        por_fabricar: group.products.filter((r) => r.status === "por_fabricar").length,
                        fabricando: group.products.filter((r) => r.status === "fabricando").length,
                        almacen: group.products.filter((r) => r.status === "almacen_no_fabricado").length,
                      }
                      const providers = [
                        ...new Set(
                          group.products
                            .map((r) => r.product.manufacturingProviderName?.trim())
                            .filter((name): name is string => Boolean(name)),
                        ),
                      ]
                      const providerLabel =
                        providers.length === 0
                          ? null
                          : providers.length === 1
                            ? providers[0]
                            : "Múltiples proveedores"

                      return (
                        <Collapsible
                          key={orderId}
                          open={isExpanded}
                          onOpenChange={() => toggleOrder(orderId)}
                        >
                          <div className="border rounded-lg overflow-hidden">
                            {/* Fila del pedido (siempre visible) */}
                            <CollapsibleTrigger className="w-full">
                              <Table>
                                <TableBody>
                                  <HoverCard openDelay={200} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <TableRow className="hover:bg-muted/50 cursor-pointer border-b">
                                        <TableCell className="font-medium" style={{ width: '150px' }}>
                                          <div className="flex items-center gap-2">
                                            {/* Checkbox para seleccionar todo el pedido */}
                                            <Checkbox
                                              checked={
                                                isOrderFullySelected(orderId)
                                                  ? true
                                                  : isOrderPartiallySelected(orderId)
                                                  ? "indeterminate"
                                                  : false
                                              }
                                              disabled={isProcessing}
                                              onCheckedChange={() => {
                                                handleToggleSelectOrder(orderId)
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              aria-label={`Seleccionar todos los productos de ${group.orderNumber}`}
                                              className="mr-2"
                                            />
                                            {isExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            )}
                                            <div>
                                              <div className="font-semibold flex items-center gap-2 flex-wrap">
                                                <span>#{group.orderNumber}</span>
                                                {isSistemaApartado({
                                                  type: "order",
                                                  saleType: group.saleType,
                                                }) && (
                                                  <Badge
                                                    variant="outline"
                                                    className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                                                    title="Sistema de Apartado"
                                                  >
                                                    SA
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {new Date(group.orderDate).toLocaleDateString()}
                                              </div>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                      <div className="font-medium">{group.clientName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {totalProducts} producto(s)
                                        {(() => {
                                          const selectedCount = group.products.filter(row => 
                                            selectedProducts.has(`${row.orderId}|${row.product.id}`)
                                          ).length
                                          if (selectedCount > 0) {
                                            return ` • ${selectedCount} seleccionado(s)`
                                          }
                                          return ''
                                        })()}
                                      </div>
                                    </TableCell>
                                        <TableCell colSpan={6}>
                                          <div className="flex items-center justify-end gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                              {statusCount.debe_fabricar > 0 && (
                                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                                  <AlertCircle className="w-3 h-3 mr-1" />
                                                  {statusCount.debe_fabricar} Debe Fabricar
                                                </Badge>
                                              )}
                                              {statusCount.por_fabricar > 0 && (
                                                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                                                  <Package className="w-3 h-3 mr-1" />
                                                  {statusCount.por_fabricar} {REPORTE_FABRICACION_LABEL}
                                                </Badge>
                                              )}
                                              {statusCount.fabricando > 0 && (
                                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                                  <Clock className="w-3 h-3 mr-1" />
                                                  {statusCount.fabricando} Fabricando
                                                </Badge>
                                              )}
                                              {statusCount.almacen > 0 && (
                                                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                                  <Package className="w-3 h-3 mr-1" />
                                                  {statusCount.almacen} En almacén
                                                </Badge>
                                              )}
                                              {providerLabel && (
                                                <span className="text-xs text-muted-foreground">
                                                  {providerLabel}
                                                </span>
                                              )}
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(`/inventario/fabricacion/${group.orderNumber}`)
                                              }}
                                            >
                                              <Eye className="w-3 h-3 mr-1" />
                                              Ver Detalles
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="min-w-[480px] max-w-[min(640px,95vw)] w-max" align="start">
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                          <span>
                                            #{group.orderNumber} - {totalProducts} producto(s)
                                          </span>
                                          {isSistemaApartado({
                                            type: "order",
                                            saleType: group.saleType,
                                          }) && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                                              title="Sistema de Apartado"
                                            >
                                              SA
                                            </Badge>
                                          )}
                                        </h4>
                                        {group.products.map((row, idx) => {
                                          const pairs = getProductAttributePairs(row.product)
                                          return (
                                            <div key={row.product.id}>
                                              {idx > 0 && <Separator className="my-3" />}
                                              <AttributesGrid pairs={pairs} productName={row.product.name} />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                </TableBody>
                              </Table>
                            </CollapsibleTrigger>

                            {/* Contenido expandible con productos */}
                            <CollapsibleContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">
                                      <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                        disabled={isProcessing}
                                        aria-label="Seleccionar todos"
                                      />
                                    </TableHead>
                                    <TableHead style={{ width: '150px' }}></TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.products.map((row) => (
                                    <HoverCard key={row.product.id} openDelay={200} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <TableRow className="hover:bg-muted/50">
                                          <TableCell>
                                            <Checkbox
                                              checked={selectedProducts.has(`${row.orderId}|${row.product.id}`)}
                                              onCheckedChange={() => handleToggleSelect(row.orderId, row.product.id)}
                                              disabled={isProcessing}
                                              aria-label={`Seleccionar ${row.product.name}`}
                                            />
                                          </TableCell>
                                          <TableCell></TableCell>
                                          <TableCell className="font-medium">
                                            {row.product.name}
                                          </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{row.product.category}</Badge>
                                      </TableCell>
                                      <TableCell>
                                        {row.product.quantity}
                                      </TableCell>
                                      <TableCell>
                                        {getStatusBadge(row.status)}
                                      </TableCell>
                                      <TableCell>
                                        {row.product.manufacturingProviderName ? (
                                          <span className="text-sm">{row.product.manufacturingProviderName}</span>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                      </TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                              {row.status === "debe_fabricar" && (
                                                <Button
                                                  size="sm"
                                                  disabled={isProcessing}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleSendToQueueClick(row.orderId, row.product)
                                                  }}
                                                >
                                                  <Package className="w-4 h-4 mr-1" />
                                                  Enviar a fabricar
                                                </Button>
                                              )}
                                              {row.status === "por_fabricar" && (
                                                <>
                                                  <Button
                                                    size="sm"
                                                    disabled={isProcessing}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleStartManufacturingClick(
                                                        row.orderId,
                                                        row.product,
                                                      )
                                                    }}
                                                  >
                                                    <Hammer className="w-4 h-4 mr-1" />
                                                    En fabricación
                                                  </Button>
                                                  {isAdmin && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={isProcessing}
                                                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRevertToDebeFabricarClick(
                                                          row.orderId,
                                                          row.product.id,
                                                        )
                                                      }}
                                                    >
                                                      <RotateCcw className="w-4 h-4 mr-1" />
                                                      Debe fabricar
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                              {row.status === "fabricando" && (
                                                <>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isProcessing}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleMarkAsFabricated(row.orderId, row.product.id)
                                                    }}
                                                  >
                                                    En almacén
                                                  </Button>
                                                  {isAdmin && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={isProcessing}
                                                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRevertToPorFabricarClick(
                                                          row.orderId,
                                                          row.product.id,
                                                        )
                                                      }}
                                                    >
                                                      <RotateCcw className="w-4 h-4 mr-1" />
                                                      {REPORTE_FABRICACION_LABEL}
                                                    </Button>
                                                  )}
                                                </>
                                              )}
                                              {row.status === "almacen_no_fabricado" && (
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  disabled={isProcessing}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRefabricationClick(row.orderId, row.product)
                                                  }}
                                                >
                                                  <RotateCcw className="w-4 h-4 mr-1" />
                                                  Reiniciar
                                                </Button>
                                              )}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="min-w-[480px] max-w-[min(640px,95vw)] w-max" align="start">
                                        <AttributesGrid
                                          pairs={getProductAttributePairs(row.product)}
                                          productName={row.product.name}
                                        />
                                      </HoverCardContent>
                                    </HoverCard>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      )
                    })}
                  </div>
                </CardContent>
                
                {/* Paginación */}
                {productRows.length > 0 && (
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
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Modal de selección de proveedor (individual) */}
      <SelectProviderDialog
        open={selectProviderDialogOpen}
        onOpenChange={(open) => {
          if (isProcessing && !open) return
          setSelectProviderDialogOpen(open)
        }}
        product={selectedProduct?.product || null}
        orderId={selectedProduct?.orderId || ""}
        onConfirm={handleProviderDialogConfirm}
        mode={providerDialogMode}
        isSubmitting={isProcessing}
      />

      {/* Modal de selección de proveedor (masivo) */}
      <SelectProviderDialog
        open={bulkManufactureDialogOpen}
        onOpenChange={(open) => {
          if (isProcessing && !open) return
          setBulkManufactureDialogOpen(open)
          if (!open) setBulkIsRefabrication(false)
        }}
        product={null}
        orderId=""
        onConfirm={handleBulkProviderDialogConfirm}
        mode={bulkIsRefabrication ? "refabrication" : bulkProviderDialogMode}
        isSubmitting={isProcessing}
      />

      {/* Dialog de confirmación para marcar como En almacén (masivo) */}
      <AlertDialog
        open={bulkFabricatedDialogOpen}
        onOpenChange={(open) => {
          if (isProcessing && !open) return
          setBulkFabricatedDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como En almacén?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas marcar {getSelectedProductsForFabricated().length} producto(s) como En almacén?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Solo se procesarán los productos con estado "Fabricando".
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkFabricatedDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeBulkMarkAsFabricated}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              En almacén
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={individualRevertDialogOpen}
        onOpenChange={(open) => {
          setIndividualRevertDialogOpen(open)
          if (!open) setRevertTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver a {REPORTE_FABRICACION_LABEL}?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto volverá a la cola de {REPORTE_FABRICACION_LABEL}. El proveedor asignado
              se mantiene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isProcessing}
              onClick={handleConfirmIndividualRevert}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkRevertDialogOpen}
        onOpenChange={(open) => {
          if (isProcessing && !open) return
          setBulkRevertDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver a {REPORTE_FABRICACION_LABEL}?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas devolver{" "}
              {getSelectedProductsForFabricated().length} producto(s) a{" "}
              {REPORTE_FABRICACION_LABEL}? El proveedor asignado se mantiene en cada línea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkRevertDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isProcessing}
              onClick={executeBulkRevertToPorFabricar}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={individualRevertToDebeFabricarDialogOpen}
        onOpenChange={(open) => {
          setIndividualRevertToDebeFabricarDialogOpen(open)
          if (!open) setRevertToDebeFabricarTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver a Debe fabricar?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto saldrá del {REPORTE_FABRICACION_LABEL} y volverá a Debe
              fabricar. Se quitará el proveedor asignado en la cola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isProcessing}
              onClick={handleConfirmIndividualRevertToDebeFabricar}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkRevertToDebeFabricarDialogOpen}
        onOpenChange={(open) => {
          if (isProcessing && !open) return
          setBulkRevertToDebeFabricarDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver a Debe fabricar?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas devolver{" "}
              {getSelectedProductsForStartManufacturing().length} producto(s) a Debe
              fabricar? Se quitará el proveedor asignado en cada línea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkRevertToDebeFabricarDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isProcessing}
              onClick={executeBulkRevertToDebeFabricar}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

