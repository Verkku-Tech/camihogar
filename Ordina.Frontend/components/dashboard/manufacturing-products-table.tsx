"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getOrders, Order, OrderProduct } from "@/lib/storage"
import { REPORTE_FABRICACION_LABEL } from "@/lib/manufacturing-labels"
import { Clock, Package, Eye } from "lucide-react"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"

interface ManufacturingProduct {
  orderId: string
  orderNumber: string
  clientName: string
  product: OrderProduct
  status: "por_fabricar" | "fabricando"
}

const DEFAULT_ITEMS_PER_PAGE = 10

export function ManufacturingProductsTable() {
  const router = useRouter()
  const [products, setProducts] = useState<ManufacturingProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedProducts,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({ data: products, itemsPerPage })

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const orders = await getOrders()
        const manufacturingProducts: ManufacturingProduct[] = []

        orders.forEach((order) => {
          if (order.status === "Generado" || order.status === "Generada") {
            return
          }
          order.products.forEach((product) => {
            // SOLO procesar productos que deben mandarse a fabricar
            if (product.locationStatus !== "FABRICACION") {
              return
            }

            const ms = product.manufacturingStatus
            if (ms !== "por_fabricar" && ms !== "fabricando") {
              return
            }

            manufacturingProducts.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              clientName: order.clientName,
              product,
              status: ms,
            })
          })
        })

        manufacturingProducts.sort((a, b) => {
          const statusOrder = { por_fabricar: 0, fabricando: 1 }
          if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status]
          }
          return a.orderNumber.localeCompare(b.orderNumber)
        })

        setProducts(manufacturingProducts)
      } catch (error) {
        console.error("Error loading manufacturing products:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TableRow key={index}>
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <Package className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No hay productos en fabricación</p>
            <p className="text-sm text-muted-foreground">
              Los productos en {REPORTE_FABRICACION_LABEL} o Fabricando aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((item) => (
                <TableRow key={`${item.orderId}-${item.product.id}`} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">{item.orderNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{item.product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.clientName}</TableCell>
                  <TableCell className="font-medium">{item.product.quantity}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.product.manufacturingProviderName || "-"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/inventario/fabricacion/${item.orderNumber}`)}
                      className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-4 py-3">
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
        </div>
      </CardContent>
    </Card>
  )
}

