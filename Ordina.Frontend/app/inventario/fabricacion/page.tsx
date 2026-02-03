"use client"

import { useState, useEffect } from "react"
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
import { Search, Filter, Hammer, CheckCircle2, AlertCircle, Clock, Package, Eye, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { getOrders, getOrder, getCategories, type Order, type OrderProduct, type Category, type AttributeValue, updateOrder } from "@/lib/storage"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import { SelectProviderDialog } from "@/components/manufacturing/select-provider-dialog"
import { useRouter } from "next/navigation"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"

// Tipo para productos agrupados por pedido
interface ProductRow {
  orderId: string
  orderNumber: string
  clientName: string
  orderDate: string
  product: OrderProduct
  status: "disponible" | "debe_fabricar" | "fabricando" | "almacen_no_fabricado"
}

export default function FabricacionPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_fabrication" | "fabricating" | "warehouse">("all")
  const [selectedProduct, setSelectedProduct] = useState<{ orderId: string; product: OrderProduct } | null>(null)
  const [selectProviderDialogOpen, setSelectProviderDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkManufactureDialogOpen, setBulkManufactureDialogOpen] = useState(false)
  const [bulkFabricatedDialogOpen, setBulkFabricatedDialogOpen] = useState(false)
  const [bulkSelectedProvider, setBulkSelectedProvider] = useState<{ id: string; name: string } | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const router = useRouter()

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

  // Procesar pedidos y crear filas de productos
  useEffect(() => {
    const rows: ProductRow[] = []

    orders.forEach(order => {
      order.products.forEach(product => {
        // SOLO procesar productos que deben mandarse a fabricar
        if (product.locationStatus !== "FABRICACION") {
          return // Saltar productos en tienda
        }

        // Determinar estado del producto (3 estados de fabricación: debe_fabricar, fabricando, almacen_no_fabricado = En almacén)
        let status: "disponible" | "debe_fabricar" | "fabricando" | "almacen_no_fabricado"
        const ms = product.manufacturingStatus as string | undefined
        if (ms === "almacen_no_fabricado" || ms === "fabricado") {
          status = "almacen_no_fabricado" // fabricado legacy → En almacén
        } else if (ms === "fabricando") {
          status = "fabricando"
        } else if (ms === "debe_fabricar") {
          status = "debe_fabricar"
        } else {
          status = "debe_fabricar"
        }

        // Agregar producto a la lista
        rows.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientName: order.clientName,
          orderDate: order.createdAt,
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
        if (filterStatus === "fabricating") return row.status === "fabricando"
        if (filterStatus === "warehouse") return row.status === "almacen_no_fabricado"
        return true
      })
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(row =>
        row.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Ordenar por pedido y luego por estado
    filtered.sort((a, b) => {
      // Primero por número de pedido
      if (a.orderNumber !== b.orderNumber) {
        return a.orderNumber.localeCompare(b.orderNumber)
      }
      // Luego por estado (debe_fabricar, fabricando, almacen_no_fabricado = En almacén, disponible)
      const statusOrder = { "debe_fabricar": 0, "fabricando": 1, "almacen_no_fabricado": 2, "disponible": 3 }
      return statusOrder[a.status] - statusOrder[b.status]
    })

    setProductRows(filtered)
  }, [orders, filterStatus, searchTerm])

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

  // Manejar click en "Fabricar"
  const handleManufactureClick = (orderId: string, product: OrderProduct) => {
    if (product.availabilityStatus === "disponible" || product.stock > 0) {
      toast.info("Este producto ya está disponible")
      return
    }
    
    setSelectedProduct({ orderId, product })
    setSelectProviderDialogOpen(true)
  }

  // Confirmar fabricación con proveedor
  const handleConfirmManufacture = async (providerId: string, providerName: string, notes?: string) => {
    if (!selectedProduct) return

    try {
      const order = await getOrder(selectedProduct.orderId)
      if (!order) throw new Error("Pedido no encontrado")

      const productIndex = order.products.findIndex(p => p.id === selectedProduct.product.id)
      if (productIndex === -1) throw new Error("Producto no encontrado")

      // Actualizar producto
      const updatedProduct = {
        ...order.products[productIndex],
        availabilityStatus: "no_disponible" as const,
        manufacturingStatus: "fabricando" as const,
        manufacturingProviderId: providerId,
        manufacturingProviderName: providerName,
        manufacturingStartedAt: new Date().toISOString(),
        manufacturingNotes: notes,
      }

      const updatedProducts = [...order.products]
      updatedProducts[productIndex] = updatedProduct

      // Actualizar pedido
      await updateOrder(order.id, {
        products: updatedProducts
      })
      
      // Refrescar
      const loadedOrders = await getOrders()
      setOrders(loadedOrders)

      toast.success(`Producto en fabricación con ${providerName}`)
      setSelectProviderDialogOpen(false)
      setSelectedProduct(null)
    } catch (error: any) {
      console.error("Error updating manufacturing status:", error)
      toast.error(error.message || "Error al actualizar el estado de fabricación")
    }
  }

  // Marcar como En almacén (último paso de fabricación)
  const handleMarkAsFabricated = async (orderId: string, productId: string) => {
    try {
      const order = await getOrder(orderId)
      if (!order) throw new Error("Pedido no encontrado")

      const productIndex = order.products.findIndex(p => p.id === productId)
      if (productIndex === -1) throw new Error("Producto no encontrado")

      const updatedProduct = {
        ...order.products[productIndex],
        manufacturingStatus: "almacen_no_fabricado" as const,
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
    }
  }

  // Agrupar productos por pedido (solo los paginados)
  const groupedRows = paginatedRows.reduce((acc, row) => {
    if (!acc[row.orderId]) {
      acc[row.orderId] = {
        orderNumber: row.orderNumber,
        clientName: row.clientName,
        orderDate: row.orderDate,
        products: []
      }
    }
    acc[row.orderId].products.push(row)
    return acc
  }, {} as Record<string, { orderNumber: string; clientName: string; orderDate: string; products: ProductRow[] }>)

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
    if (checked) {
      const keys = paginatedRows.map(row => `${row.orderId}|${row.product.id}`)
      setSelectedProducts(new Set(keys))
    } else {
      setSelectedProducts(new Set())
    }
  }

  // Manejar selección de todos los productos de un pedido
  const handleToggleSelectOrder = (orderId: string) => {
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
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    // Filtrar solo productos que estén en "debe_fabricar"
    const selectedKeys = Array.from(selectedProducts)
    const validProducts = selectedKeys.filter(key => {
      const [orderId, productId] = key.split('|')
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "debe_fabricar"
    })

    if (validProducts.length === 0) {
      toast.error("Solo se pueden mandar a fabricar productos con estado 'Debe Fabricar'")
      return
    }

    setBulkManufactureDialogOpen(true)
  }

  // Manejar click en "Marcar como Fabricado" (masivo)
  const handleBulkMarkAsFabricated = () => {
    if (selectedProducts.size === 0) {
      toast.error("Por favor selecciona al menos un producto")
      return
    }

    // Filtrar solo productos que estén en "fabricando"
    const selectedKeys = Array.from(selectedProducts)
    const validProducts = selectedKeys.filter(key => {
      const [orderId, productId] = key.split('|')
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "fabricando"
    })

    if (validProducts.length === 0) {
      toast.error("Solo se pueden marcar como fabricados productos con estado 'Fabricando'")
      return
    }

    setBulkFabricatedDialogOpen(true)
  }

  // Ejecutar acción masiva de fabricación
  const executeBulkManufacture = async (providerId: string, providerName: string, notes?: string) => {
    const selectedKeys = Array.from(selectedProducts)
    let successCount = 0
    let errorCount = 0

    for (const key of selectedKeys) {
      const [orderId, productId] = key.split('|')
      try {
        const order = await getOrder(orderId)
        if (!order) {
          errorCount++
          continue
        }

        const productIndex = order.products.findIndex(p => p.id === productId)
        if (productIndex === -1) {
          errorCount++
          continue
        }

        // Solo actualizar productos que estén en "debe_fabricar"
        if (order.products[productIndex].manufacturingStatus !== "debe_fabricar" && 
            !order.products[productIndex].manufacturingStatus) {
          continue
        }

        const updatedProduct = {
          ...order.products[productIndex],
          availabilityStatus: "no_disponible" as const,
          manufacturingStatus: "fabricando" as const,
          manufacturingProviderId: providerId,
          manufacturingProviderName: providerName,
          manufacturingStartedAt: new Date().toISOString(),
          manufacturingNotes: notes,
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

    // Refrescar
    const loadedOrders = await getOrders()
    setOrders(loadedOrders)
    setSelectedProducts(new Set())
    setBulkManufactureDialogOpen(false)
    setBulkSelectedProvider(null)

    if (errorCount === 0) {
      toast.success(`${successCount} producto(s) enviado(s) a fabricación`)
    } else {
      toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
    }
  }

  // Ejecutar acción masiva de "marcar como fabricado"
  const executeBulkMarkAsFabricated = async () => {
    const selectedKeys = Array.from(selectedProducts)
    let successCount = 0
    let errorCount = 0

    for (const key of selectedKeys) {
      const [orderId, productId] = key.split('|')
      try {
        const order = await getOrder(orderId)
        if (!order) {
          errorCount++
          continue
        }

        const productIndex = order.products.findIndex(p => p.id === productId)
        if (productIndex === -1) {
          errorCount++
          continue
        }

        // Solo actualizar productos que estén en "fabricando"
        if (order.products[productIndex].manufacturingStatus !== "fabricando") {
          continue
        }

        const updatedProduct = {
          ...order.products[productIndex],
          manufacturingStatus: "almacen_no_fabricado" as const,
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

    // Refrescar
    const loadedOrders = await getOrders()
    setOrders(loadedOrders)
    setSelectedProducts(new Set())
    setBulkFabricatedDialogOpen(false)

    if (errorCount === 0) {
      toast.success(`${successCount} producto(s) marcado(s) como fabricado(s)`)
    } else {
      toast.warning(`${successCount} exitoso(s), ${errorCount} error(es)`)
    }
  }

  // Calcular si todos están seleccionados (solo los paginados)
  const allSelected = paginatedRows.length > 0 && selectedProducts.size === paginatedRows.length
  const someSelected = selectedProducts.size > 0 && selectedProducts.size < paginatedRows.length

  // Obtener productos seleccionados válidos para cada acción
  const getSelectedProductsForManufacture = () => {
    return Array.from(selectedProducts).filter(key => {
      const [orderId, productId] = key.split('|')
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "debe_fabricar"
    })
  }

  const getSelectedProductsForFabricated = () => {
    return Array.from(selectedProducts).filter(key => {
      const [orderId, productId] = key.split('|')
      const row = productRows.find(r => r.orderId === orderId && r.product.id === productId)
      return row && row.status === "fabricando"
    })
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

            {/* Filtros */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Buscar por pedido, cliente o producto..."
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

                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="needs_fabrication">Debe Fabricar</SelectItem>
                        <SelectItem value="fabricating">Fabricando</SelectItem>
                        <SelectItem value="warehouse">En almacén</SelectItem>
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
                    {getSelectedProductsForManufacture().length > 0 && (
                      <Button
                        onClick={handleBulkManufacture}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Hammer className="w-4 h-4 mr-2" />
                        Mandar a Fabricar ({getSelectedProductsForManufacture().length})
                      </Button>
                    )}
                    {getSelectedProductsForFabricated().length > 0 && (
                      <Button
                        onClick={handleBulkMarkAsFabricated}
                        variant="outline"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Marcar como Fabricado ({getSelectedProductsForFabricated().length})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
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
                    {searchTerm || filterStatus !== "all"
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
                                              onCheckedChange={(checked) => {
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
                                              <div className="font-semibold">#{group.orderNumber}</div>
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
                                          <div className="flex items-center justify-end gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs"
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
                                        <h4 className="font-semibold text-sm">
                                          #{group.orderNumber} - {totalProducts} producto(s)
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
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleManufactureClick(row.orderId, row.product)
                                                  }}
                                                >
                                                  <Hammer className="w-4 h-4 mr-1" />
                                                  Fabricar
                                                </Button>
                                              )}
                                              {row.status === "fabricando" && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleMarkAsFabricated(row.orderId, row.product.id)
                                                  }}
                                                >
                                                  En almacén
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
        onOpenChange={setSelectProviderDialogOpen}
        product={selectedProduct?.product || null}
        orderId={selectedProduct?.orderId || ""}
        onConfirm={handleConfirmManufacture}
      />

      {/* Modal de selección de proveedor (masivo) */}
      <SelectProviderDialog
        open={bulkManufactureDialogOpen}
        onOpenChange={setBulkManufactureDialogOpen}
        product={null}
        orderId=""
        onConfirm={executeBulkManufacture}
      />

      {/* Dialog de confirmación para marcar como En almacén (masivo) */}
      <AlertDialog open={bulkFabricatedDialogOpen} onOpenChange={setBulkFabricatedDialogOpen}>
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              En almacén
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

