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
import { Search, Filter, Hammer, CheckCircle2, AlertCircle, Clock, Package, Eye, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { getOrders, getOrder, type Order, type OrderProduct, updateOrder } from "@/lib/storage"
import { SelectProviderDialog } from "@/components/manufacturing/select-provider-dialog"
import { useRouter } from "next/navigation"

// Tipo para productos agrupados por pedido
interface ProductRow {
  orderId: string
  orderNumber: string
  clientName: string
  orderDate: string
  product: OrderProduct
  status: "disponible" | "debe_fabricar" | "fabricando" | "fabricado"
}

export default function FabricacionPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_fabrication" | "fabricating" | "fabricated">("all")
  const [selectedProduct, setSelectedProduct] = useState<{ orderId: string; product: OrderProduct } | null>(null)
  const [selectProviderDialogOpen, setSelectProviderDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const router = useRouter()

  // Cargar pedidos
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const loadedOrders = await getOrders()
        setOrders(loadedOrders)
      } catch (error) {
        console.error("Error loading orders:", error)
        toast.error("Error al cargar los pedidos")
      }
    }
    loadOrders()
  }, [])

  // Procesar pedidos y crear filas de productos
  useEffect(() => {
    const rows: ProductRow[] = []

    orders.forEach(order => {
      order.products.forEach(product => {
        // SOLO procesar productos que deben mandarse a fabricar
        if (product.locationStatus !== "mandar_a_fabricar") {
          return // Saltar productos en tienda
        }

        // Determinar estado del producto para fabricación
        let status: "disponible" | "debe_fabricar" | "fabricando" | "fabricado"
        
        // Si tiene manufacturingStatus, usar ese
        if (product.manufacturingStatus === "fabricado") {
          status = "fabricado"
        } else if (product.manufacturingStatus === "fabricando") {
          status = "fabricando"
        } else if (product.manufacturingStatus === "debe_fabricar") {
          status = "debe_fabricar"
        } 
        // Si no tiene manufacturingStatus, asumir que debe fabricarse
        else {
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
        if (filterStatus === "fabricated") return row.status === "fabricado"
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
      // Luego por estado (debe_fabricar primero, luego fabricando, luego fabricado)
      const statusOrder = { "debe_fabricar": 0, "fabricando": 1, "fabricado": 2, "disponible": 3 }
      return statusOrder[a.status] - statusOrder[b.status]
    })

    setProductRows(filtered)
  }, [orders, filterStatus, searchTerm])

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
      case "fabricado":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Fabricado
          </Badge>
        )
      default:
        return null
    }
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

  // Marcar como fabricado
  const handleMarkAsFabricated = async (orderId: string, productId: string) => {
    try {
      const order = await getOrder(orderId)
      if (!order) throw new Error("Pedido no encontrado")

      const productIndex = order.products.findIndex(p => p.id === productId)
      if (productIndex === -1) throw new Error("Producto no encontrado")

      const updatedProduct = {
        ...order.products[productIndex],
        manufacturingStatus: "fabricado" as const,
        manufacturingCompletedAt: new Date().toISOString(),
      }

      const updatedProducts = [...order.products]
      updatedProducts[productIndex] = updatedProduct

      await updateOrder(order.id, {
        products: updatedProducts
      })
      
      const loadedOrders = await getOrders()
      setOrders(loadedOrders)

      toast.success("Producto marcado como fabricado")
    } catch (error: any) {
      console.error("Error marking as fabricated:", error)
      toast.error(error.message || "Error al actualizar el estado")
    }
  }

  // Agrupar productos por pedido
  const groupedRows = productRows.reduce((acc, row) => {
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
                        <SelectItem value="fabricated">Fabricado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                    {productRows.length} producto(s) encontrado(s)
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
                                  <TableRow className="hover:bg-muted/50 cursor-pointer border-b">
                                    <TableCell className="font-medium" style={{ width: '150px' }}>
                                      <div className="flex items-center gap-2">
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
                                </TableBody>
                              </Table>
                            </CollapsibleTrigger>

                            {/* Contenido expandible con productos */}
                            <CollapsibleContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead style={{ width: '150px' }}></TableHead>
                                    <TableHead></TableHead>
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
                                    <TableRow key={row.product.id}>
                                      <TableCell></TableCell>
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
                                              onClick={() => handleManufactureClick(row.orderId, row.product)}
                                            >
                                              <Hammer className="w-4 h-4 mr-1" />
                                              Fabricar
                                            </Button>
                                          )}
                                          {row.status === "fabricando" && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleMarkAsFabricated(row.orderId, row.product.id)}
                                            >
                                              Marcar como Fabricado
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
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
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Modal de selección de proveedor */}
      <SelectProviderDialog
        open={selectProviderDialogOpen}
        onOpenChange={setSelectProviderDialogOpen}
        product={selectedProduct?.product || null}
        orderId={selectedProduct?.orderId || ""}
        onConfirm={handleConfirmManufacture}
      />
    </div>
  )
}

